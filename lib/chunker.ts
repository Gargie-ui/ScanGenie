import { AutoTokenizer } from '@xenova/transformers';

/**
 * Token-aware, structure-aware chunker aligned with the embedding model.
 *
 * Fixes vs. the old version:
 *  1. Tokens are counted with MiniLM's OWN tokenizer (not cl100k), so a chunk
 *     that is "200 tokens" here is 200 tokens to the embedding model too.
 *  2. Default chunk size is 200 (MiniLM truncates at 256 incl. 2 special
 *     tokens), so no chunk tail is silently dropped from its embedding.
 *  3. Text is always split into sentence blocks, so overlap actually works
 *     (before, a long trailing paragraph meant zero overlap).
 *  4. Sentence splitting uses Intl.Segmenter instead of a naive regex
 *     (better on "e.g.", "3.5", decimals, etc.).
 *  5. Oversized sentences are hard-split by words, never mid-word.
 *
 * NOTE: chunkPages is now async (the tokenizer loads asynchronously).
 * Callers must: `const chunks = await chunkPages(pages);`
 */

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

// Loaded once and reused across requests (warm serverless instances).
let tokenizerPromise: Promise<any> | null = null;
function getTokenizer() {
  if (!tokenizerPromise) {
    tokenizerPromise = AutoTokenizer.from_pretrained(MODEL_ID);
  }
  return tokenizerPromise;
}

export interface TextPage {
  pageNumber: number;
  text: string;
}

export interface ChunkedSegment {
  content: string;
  tokenCount: number;
  pageNumber: number;
  chunkIndex: number;
}

interface Block {
  text: string;
  tokens: number;
  startsParagraph: boolean; // controls how blocks are re-joined
}

type CountFn = (text: string) => number;

// ---------- sentence splitting ----------

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new (Intl as any).Segmenter('en', { granularity: 'sentence' })
    : null;

function splitSentences(paragraph: string): string[] {
  if (segmenter) {
    return Array.from(segmenter.segment(paragraph) as Iterable<{ segment: string }>)
      .map((s) => s.segment.trim())
      .filter(Boolean);
  }
  // Fallback if Intl.Segmenter is unavailable
  return paragraph
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------- hard split for oversized sentences ----------

function hardSplit(sentence: string, chunkSize: number, count: CountFn): string[] {
  const parts: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  const flush = () => {
    if (current.length) {
      parts.push(current.join(' '));
      current = [];
      currentTokens = 0;
    }
  };

  for (const word of sentence.split(/\s+/).filter(Boolean)) {
    const wordTokens = count(word);

    // Pathological token (e.g. giant URL / base64): slice by characters.
    if (wordTokens > chunkSize) {
      flush();
      const step = chunkSize * 3; // ~3 chars/token as a safe estimate
      for (let i = 0; i < word.length; i += step) {
        parts.push(word.slice(i, i + step));
      }
      continue;
    }

    if (currentTokens + wordTokens > chunkSize) flush();
    current.push(word);
    currentTokens += wordTokens;
  }
  flush();
  return parts;
}

// ---------- page -> blocks ----------

function buildBlocks(pageText: string, chunkSize: number, count: CountFn): Block[] {
  let paragraphs = pageText.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length <= 1) {
    // PDFs often have single newlines only
    paragraphs = pageText.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
  }

  const blocks: Block[] = [];
  for (const paragraph of paragraphs) {
    let first = true;
    for (const sentence of splitSentences(paragraph)) {
      const tokens = count(sentence);
      if (tokens <= chunkSize) {
        blocks.push({ text: sentence, tokens, startsParagraph: first });
        first = false;
      } else {
        for (const part of hardSplit(sentence, chunkSize, count)) {
          blocks.push({ text: part, tokens: count(part), startsParagraph: first });
          first = false;
        }
      }
    }
  }
  return blocks;
}

function joinBlocks(blocks: Block[]): string {
  let out = '';
  blocks.forEach((b, i) => {
    if (i === 0) out = b.text;
    else out += (b.startsParagraph ? '\n\n' : ' ') + b.text;
  });
  return out;
}

// ---------- main ----------

/**
 * Splits pages into chunks that:
 *  - never exceed `chunkSize` MiniLM tokens (when possible),
 *  - respect paragraph/sentence boundaries,
 *  - never cross a page boundary (exact page citations),
 *  - overlap by whole sentences totalling <= `chunkOverlap` tokens.
 */
export async function chunkPages(
  pages: TextPage[],
  chunkSize = 200,
  chunkOverlap = 40
): Promise<ChunkedSegment[]> {
  const tokenizer = await getTokenizer();
  // Exclude [CLS]/[SEP] so counts match the embedding model's content limit.
  const count: CountFn = (text) =>
    tokenizer(text, { add_special_tokens: false }).input_ids.data.length;

  const chunks: ChunkedSegment[] = [];
  let overallChunkIndex = 0;

  for (const page of pages) {
    const pageText = page.text.trim();
    if (!pageText) continue;

    const blocks = buildBlocks(pageText, chunkSize, count);
    let currentIndex = 0;

    while (currentIndex < blocks.length) {
      let currentTokens = 0;
      let endIndex = currentIndex;

      // Greedily pack blocks until the next one would overflow
      while (endIndex < blocks.length) {
        const block = blocks[endIndex];
        if (currentTokens + block.tokens > chunkSize && endIndex > currentIndex) break;
        currentTokens += block.tokens;
        endIndex++;
      }

      const chunkBlocks = blocks.slice(currentIndex, endIndex);
      chunks.push({
        content: joinBlocks(chunkBlocks),
        tokenCount: currentTokens,
        pageNumber: page.pageNumber,
        chunkIndex: overallChunkIndex++,
      });

      if (endIndex >= blocks.length) break;

      // Walk backwards to pick trailing sentences for overlap.
      // `i > currentIndex` guarantees forward progress (no infinite loop).
      let nextStart = endIndex;
      let overlapTokens = 0;
      for (let i = endIndex - 1; i > currentIndex; i--) {
        if (overlapTokens + blocks[i].tokens <= chunkOverlap) {
          overlapTokens += blocks[i].tokens;
          nextStart = i;
        } else {
          break;
        }
      }
      currentIndex = nextStart;
    }
  }

  return chunks;
}
