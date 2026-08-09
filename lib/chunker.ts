import { getEncoding } from 'js-tiktoken';

let encoder: any = null;

function getEncoder() {
  if (!encoder) {
    encoder = getEncoding('cl100k_base');
  }
  return encoder;
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

/**
 * Splits text pages into semantically bounded chunks (paragraphs/sentences)
 * that do not exceed the target token size, incorporating overlap.
 */
export function chunkPages(
  pages: TextPage[],
  chunkSize = 500,
  chunkOverlap = 50
): ChunkedSegment[] {
  const enc = getEncoder();
  const chunks: ChunkedSegment[] = [];
  let overallChunkIndex = 0;

  for (const page of pages) {
    const pageText = page.text.trim();
    if (!pageText) continue;

    // 1. Break page into paragraph blocks
    let rawParagraphs = pageText.split(/\r?\n\r?\n/).map(p => p.trim()).filter(Boolean);
    if (rawParagraphs.length <= 1) {
      rawParagraphs = pageText.split(/\r?\n/).map(p => p.trim()).filter(Boolean);
    }

    // 2. Prepare sub-blocks (split too-large paragraphs into sentences)
    const blocks: { text: string; tokens: number }[] = [];
    for (const paragraph of rawParagraphs) {
      const paragraphTokens = enc.encode(paragraph).length;

      if (paragraphTokens <= chunkSize) {
        blocks.push({ text: paragraph, tokens: paragraphTokens });
      } else {
        // Split long paragraphs into sentence blocks using lookbehind to retain punctuation
        const sentences = paragraph.split(/(?<=[.?!])\s+/).map(s => s.trim()).filter(Boolean);
        for (const sentence of sentences) {
          const sentenceTokens = enc.encode(sentence).length;
          
          if (sentenceTokens <= chunkSize) {
            blocks.push({ text: sentence, tokens: sentenceTokens });
          } else {
            // Force-split sentences that are extremely long by token count
            const tokens = enc.encode(sentence);
            let start = 0;
            while (start < tokens.length) {
              const end = Math.min(start + chunkSize, tokens.length);
              const partTokens = tokens.slice(start, end);
              const partText = enc.decode(partTokens);
              blocks.push({ text: partText.trim(), tokens: partTokens.length });
              start += chunkSize;
            }
          }
        }
      }
    }

    // 3. Accumulate blocks into chunks with token-bounded block overlap
    let currentIndex = 0;
    while (currentIndex < blocks.length) {
      let currentTokens = 0;
      const chunkBlocks: string[] = [];
      let endIndex = currentIndex;

      // Add blocks until adding the next would exceed the chunkSize limit
      while (endIndex < blocks.length) {
        const block = blocks[endIndex];
        if (currentTokens + block.tokens > chunkSize && chunkBlocks.length > 0) {
          break;
        }
        chunkBlocks.push(block.text);
        currentTokens += block.tokens;
        endIndex++;
      }

      chunks.push({
        content: chunkBlocks.join('\n\n'),
        tokenCount: currentTokens,
        pageNumber: page.pageNumber,
        chunkIndex: overallChunkIndex++,
      });

      if (endIndex >= blocks.length) {
        break;
      }

      // Calculate next starting index using block overlap
      let nextStartIndex = endIndex;
      let overlapTokens = 0;

      for (let i = endIndex - 1; i >= currentIndex; i--) {
        if (overlapTokens + blocks[i].tokens <= chunkOverlap) {
          overlapTokens += blocks[i].tokens;
          nextStartIndex = i;
        } else {
          break;
        }
      }

      // Avoid infinite loops if overlap size causes zero forward progress
      if (nextStartIndex === currentIndex) {
        currentIndex = endIndex;
      } else {
        currentIndex = nextStartIndex;
      }
    }
  }

  return chunks;
}
