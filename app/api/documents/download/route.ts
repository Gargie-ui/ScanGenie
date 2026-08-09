import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * GET /api/documents/download?id=UUID
 * Serves the uploaded document file from local uploads storage.
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
    const storedFilename = `${docId}-${filename}`;
    const filePath = path.join(process.cwd(), 'uploads', storedFilename);

    try {
      const fileBuffer = await fs.readFile(filePath);
      
      // Determine content type
      let contentType = 'application/octet-stream';
      if (filename.endsWith('.pdf')) {
        contentType = 'application/pdf';
      } else if (filename.endsWith('.docx')) {
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (filename.endsWith('.txt')) {
        contentType = 'text/plain';
      }

      return new Response(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
        },
      });
    } catch (fileErr) {
      console.error('File read error:', fileErr);
      return NextResponse.json({ error: 'File not found on local storage disk' }, { status: 404 });
    }
  } catch (error: any) {
    console.error('Error serving file:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
