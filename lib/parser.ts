import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';
import { TextPage } from './chunker';

/**
 * Parses a PDF file buffer page-by-page.
 */
export async function parsePdf(fileBuffer: Buffer): Promise<TextPage[]> {
  const pdf = await getDocumentProxy(new Uint8Array(fileBuffer));
  const { text } = await extractText(pdf, { mergePages: false });
  // text is an array with one string per page
  return text.map((t, i) => ({
    pageNumber: i + 1,
    text: t.trim(),
  }));
}

import JSZip from 'jszip';

/**
 * Parses a DOCX file buffer into individual pages.
 * Inspects OpenXML page breaks (<w:lastRenderedPageBreak/> and <w:br w:type="page"/>).
 * Falls back to mammoth and word-count estimation if explicit page breaks are missing.
 */
export async function parseDocx(fileBuffer: Buffer): Promise<TextPage[]> {
  try {
    const zip = await JSZip.loadAsync(fileBuffer);
    const documentXmlFile = zip.file('word/document.xml');

    if (documentXmlFile) {
      const docXml = await documentXmlFile.async('text');

      const tagRegex = /<w:lastRenderedPageBreak\b[^>]*\/?>|<w:br\b[^>]*w:type="page"[^>]*\/?>|<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\/>|<\/w:p>|<w:br\b[^>]*\/?>/g;

      const pages: TextPage[] = [];
      let currentPage = 1;
      let pageText = '';
      let breakFound = false;

      let match;
      while ((match = tagRegex.exec(docXml)) !== null) {
        const fullTag = match[0];
        if (fullTag.includes('lastRenderedPageBreak') || (fullTag.includes('w:br') && fullTag.includes('w:type="page"'))) {
          breakFound = true;
          if (pageText.trim()) {
            pages.push({ pageNumber: currentPage, text: pageText.trim() });
          }
          currentPage++;
          pageText = '';
        } else if (match[1] !== undefined) {
          const text = match[1]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
          pageText += text;
        } else if (fullTag === '<w:tab/>') {
          pageText += '\t';
        } else if (fullTag === '</w:p>' || fullTag.startsWith('<w:br')) {
          pageText += '\n';
        }
      }

      if (pageText.trim()) {
        pages.push({ pageNumber: currentPage, text: pageText.trim() });
      }

      if (pages.length > 0 && breakFound) {
        return pages;
      }
    }
  } catch (err) {
    console.warn('DOCX XML page-break parsing failed, falling back to mammoth:', err);
  }

  // Fallback to mammoth for unstructured or unpaginated DOCX files
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  const rawText = result.value.trim();

  // If text is long (> 400 words) but no explicit page break XML tags existed,
  // chunk into estimated pages (~350 words per standard printed page)
  const words = rawText.split(/\s+/).filter(Boolean);
  if (words.length > 400) {
    const WORDS_PER_PAGE = 350;
    const estimatedPages: TextPage[] = [];
    for (let i = 0; i < words.length; i += WORDS_PER_PAGE) {
      const pageWords = words.slice(i, i + WORDS_PER_PAGE);
      estimatedPages.push({
        pageNumber: Math.floor(i / WORDS_PER_PAGE) + 1,
        text: pageWords.join(' '),
      });
    }
    return estimatedPages;
  }

  return [{ pageNumber: 1, text: rawText }];
}

/**
 * Parses a TXT file buffer. Long text is split into ~350 word pages.
 */
export async function parseTxt(fileBuffer: Buffer): Promise<TextPage[]> {
  const text = fileBuffer.toString('utf-8').trim();
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 400) {
    const WORDS_PER_PAGE = 350;
    const pages: TextPage[] = [];
    for (let i = 0; i < words.length; i += WORDS_PER_PAGE) {
      pages.push({
        pageNumber: Math.floor(i / WORDS_PER_PAGE) + 1,
        text: words.slice(i, i + WORDS_PER_PAGE).join(' '),
      });
    }
    return pages;
  }
  return [{ pageNumber: 1, text }];
}

/**
 * Main parser entry point.
 */
export async function parseDocument(
  fileBuffer: Buffer,
  fileType: string
): Promise<TextPage[]> {
  const normalizedType = fileType.toLowerCase();

  if (normalizedType === 'pdf' || normalizedType.endsWith('.pdf') || normalizedType.includes('pdf')) {
    return parsePdf(fileBuffer);
  } else if (
    normalizedType === 'docx' ||
    normalizedType.endsWith('.docx') ||
    normalizedType.includes('officedocument.wordprocessingml.document')
  ) {
    return parseDocx(fileBuffer);
  } else if (
    normalizedType === 'txt' ||
    normalizedType.endsWith('.txt') ||
    normalizedType.includes('text/plain')
  ) {
    return parseTxt(fileBuffer);
  } else {
    throw new Error(`Unsupported file type: ${fileType}`);
  }
}
