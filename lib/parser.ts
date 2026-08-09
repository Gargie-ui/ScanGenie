import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { TextPage } from './chunker';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

// Explicitly register the worker module path as a file:// URL.
// This prevents PDF.js from attempting to dynamically import the worker from the compiled Next.js server chunks directory at runtime,
// which causes module resolution crashes in Next.js/Turbopack.
if (typeof window === 'undefined') {
  let workerPath = '';
  const pathsToTry = [
    path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'),
    path.join(process.cwd(), 'node_modules/pdf-parse/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'),
  ];
  
  for (const p of pathsToTry) {
    if (fs.existsSync(p)) {
      workerPath = p;
      break;
    }
  }
  
  if (workerPath) {
    PDFParse.setWorker(pathToFileURL(workerPath).href);
  }
}

/**
 * Parses a PDF file buffer page-by-page.
 */
export async function parsePdf(fileBuffer: Buffer): Promise<TextPage[]> {
  const parser = new PDFParse({ data: fileBuffer });
  try {
    const result = await parser.getText();
    return result.pages.map((p) => ({
      pageNumber: p.num,
      text: p.text.trim(),
    }));
  } finally {
    // Ensure we destroy PDF instances to avoid memory leaks
    await parser.destroy();
  }
}

/**
 * Parses a DOCX file buffer.
 */
export async function parseDocx(fileBuffer: Buffer): Promise<TextPage[]> {
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  return [
    {
      pageNumber: 1,
      text: result.value.trim(),
    },
  ];
}

/**
 * Parses a TXT file buffer.
 */
export async function parseTxt(fileBuffer: Buffer): Promise<TextPage[]> {
  const text = fileBuffer.toString('utf-8');
  return [
    {
      pageNumber: 1,
      text: text.trim(),
    },
  ];
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
