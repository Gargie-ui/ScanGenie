import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * DELETE /api/documents/[id]
 * Deletes a document, its stored file, and all associated chunks from Supabase.
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
      .select('id')
      .eq('id', docId)
      .single();

    if (fetchError || !docData) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // 2. Delete the stored original before removing its metadata.
    const { error: storageError } = await supabase.storage.from('documents').remove([docId]);
    if (storageError) {
      throw storageError;
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
