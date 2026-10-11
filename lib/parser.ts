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

/**
 * Parses a DOCX file buffer.
 */
export async function parseDocx(fileBuffer: Buffer): Promise<TextPage[]> {
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  return [{ pageNumber: 1, text: result.value.trim() }];
}

/**
 * Parses a TXT file buffer.
 */
export async function parseTxt(fileBuffer: Buffer): Promise<TextPage[]> {
  const text = fileBuffer.toString('utf-8');
  return [{ pageNumber: 1, text: text.trim() }];
}

/**
 * Main parser entry point.
 */
export async function parseDocument(
  fileBuffer: Buffer,
  fileType: string
): Promise<TextPage[]> {
  const normalizedType = fileType.toLowerCase();

  if (normalizedType === 'pdf' || fileType.includes('pdf')) {
    return parsePdf(fileBuffer);
  } else if (
    normalizedType === 'docx' ||
    fileType.includes('officedocument.wordprocessingml.document')
  ) {
    return parseDocx(fileBuffer);
  } else if (normalizedType === 'txt' || fileType.includes('text/plain')) {
    return parseTxt(fileBuffer);
  } else {
    throw new Error(`Unsupported file type: ${fileType}`);
  }
}
