import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * DELETE /api/documents/[id]
 * Deletes a document, its local file, and all associated chunks from Supabase.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: docId } = await params;

    if (!docId) {
      return NextResponse.json({ error: 'Missing document ID parameter' }, { status: 400 });
    }

    // 1. Fetch document metadata from Supabase
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

    // 2. Delete local file from disk (silently ignore if not found)
    try {
      await fs.unlink(filePath);
      console.log(`Deleted file: ${filePath}`);
    } catch (fsErr: any) {
      console.warn(`File delete warning: ${fsErr.message}`);
    }

    // 3. Delete document from Supabase (cascading deletes will handle document_chunks)
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', docId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true, deletedId: docId });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
