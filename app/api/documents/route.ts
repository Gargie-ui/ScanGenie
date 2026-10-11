import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserIdFromRequest } from '@/lib/auth';
import { parseDocument } from '@/lib/parser';
import { chunkPages } from '@/lib/chunker';
import { generateEmbeddings } from '@/lib/embedding';
import crypto from 'crypto';

export const maxDuration = 300; // 5 minutes max execution time for long uploads

/**
 * GET /api/documents
 * Lists all uploaded documents for the authenticated user.
 * Guests see documents with user_id = NULL.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);

    let query = supabase
      .from('documents')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.is('user_id', null);
    }

    const { data: docs, error } = await query;

    if (error) {
      throw error;
    }

    const formattedDocs = docs.map((doc: any) => ({
      id: doc.id,
      filename: doc.filename,
      fileUrl: doc.file_url,
      fileType: doc.file_type,
      wordCount: doc.word_count,
      pageCount: doc.page_count,
      uploadedAt: new Date(doc.uploaded_at),
    }));

    return NextResponse.json(formattedDocs);
  } catch (error: any) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/documents
 * Handles file upload, text extraction, chunking, embedding generation, and DB storage in Supabase.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  try {
    const formData = await req.formData();
    const file = formData.get('file') as Blob | null;

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const filename = (formData.get('filename') as string) || 'document.pdf';
    const buffer = Buffer.from(await file.arrayBuffer());

    // 1. Parse text from document based on file type
    let pages;
    try {
      pages = await parseDocument(buffer, filename);
    } catch (parseErr: any) {
      console.error('Parsing error:', parseErr);
      return NextResponse.json({ error: `Failed to parse document: ${parseErr.message}` }, { status: 422 });
    }

    if (pages.length === 0 || pages.every(p => !p.text.trim())) {
      return NextResponse.json({ error: 'Document appears to be empty or has no readable text.' }, { status: 422 });
    }

    // Generate a unique document ID
    const docId = crypto.randomUUID();

    const fileExtension = filename.split('.').pop() || '';

    // 2. Generate token chunks
    const chunks = await chunkPages(pages);

    // 3. Calculate stats
    let totalWordCount = 0;
    pages.forEach((page) => {
      totalWordCount += page.text.split(/\s+/).filter(Boolean).length;
    });

    // 4. Generate embeddings in sequential batches (ONNX runtime is single-threaded,
    //    so concurrent calls just queue up and add overhead)
    console.log(`Generating embeddings for ${chunks.length} chunks...`);
    const BATCH_SIZE = 10;
    const resolvedChunks: any[] = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const embeddings = await generateEmbeddings(batch.map((chunk) => chunk.content));
      const batchResults = batch.map((chunk, index) => ({
        id: crypto.randomUUID(),
        document_id: docId,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        embedding: embeddings[index],
        metadata: {
          pageNumber: chunk.pageNumber,
          filename,
        },
      }));
      resolvedChunks.push(...batchResults);
      console.log(`  Embedded ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length} chunks`);
    }

    // 5. Store the original outside the serverless function's ephemeral filesystem.
    let { error: storageError } = await supabase.storage
      .from('documents')
      .upload(docId, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (storageError && (storageError.message?.includes('Bucket not found') || (storageError as any).code === 'NoSuchBucket')) {
      console.warn("Storage bucket 'documents' not found. Creating bucket automatically...");
      await supabase.storage.createBucket('documents', { public: true, fileSizeLimit: 52428800 });
      const retry = await supabase.storage
        .from('documents')
        .upload(docId, buffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });
      storageError = retry.error;
    }

    if (storageError) {
      throw storageError;
    }

    // 6. Insert metadata and chunks into Supabase
    // Insert document record
    const { error: docError } = await supabase
      .from('documents')
      .insert({
        id: docId,
        filename: filename,
        file_url: `/api/documents/download?id=${docId}`,
        file_type: fileExtension,
        word_count: totalWordCount,
        page_count: pages.length,
        user_id: userId,
      });

    if (docError) {
      const { error: cleanupError } = await supabase.storage.from('documents').remove([docId]);
      if (cleanupError) {
        console.error('Failed to clean up uploaded document after metadata insert failure:', cleanupError);
      }
      throw docError;
    }

    // Bulk insert chunk records
    const { error: chunkError } = await supabase
      .from('document_chunks')
      .insert(resolvedChunks);

    if (chunkError) {
      // Cleanup the document record if chunk insertion fails
      const { error: documentCleanupError } = await supabase.from('documents').delete().eq('id', docId);
      if (documentCleanupError) {
        console.error('Failed to clean up document metadata after chunk insert failure:', documentCleanupError);
      }
      const { error: storageCleanupError } = await supabase.storage.from('documents').remove([docId]);
      if (storageCleanupError) {
        console.error('Failed to clean up uploaded document after chunk insert failure:', storageCleanupError);
      }
      throw chunkError;
    }

    console.log(`Successfully ingested document "${filename}" with ID: ${docId}`);

    return NextResponse.json({
      success: true,
      documentId: docId,
      filename,
      chunksCount: chunks.length,
    });
  } catch (error: any) {
    console.error('Error during document upload/ingestion:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
