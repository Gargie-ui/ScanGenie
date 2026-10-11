import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/documents/download?id=UUID
 * Serves the uploaded document file from Supabase Storage.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get('id');

    if (!docId) {
      return NextResponse.json({ error: 'Missing document ID parameter' }, { status: 400 });
    }

    const { data: docData, error: fetchError } = await supabase
      .from('documents')
      .select('filename')
      .eq('id', docId)
      .single();

    if (fetchError || !docData) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const filename = docData.filename;
    const { data: file, error: storageError } = await supabase.storage
      .from('documents')
      .download(docId);

    if (storageError || !file) {
      console.error('File download error:', storageError);
      return NextResponse.json({ error: 'File not found in document storage' }, { status: 404 });
    }

    let contentType = 'application/octet-stream';
    if (filename.toLowerCase().endsWith('.pdf')) {
      contentType = 'application/pdf';
    } else if (filename.toLowerCase().endsWith('.docx')) {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (filename.toLowerCase().endsWith('.txt')) {
      contentType = 'text/plain';
    }

    return new Response(file, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error: any) {
    console.error('Error serving file:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
