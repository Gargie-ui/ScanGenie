import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/chats/[id]
 * Retrieves all messages within a specific chat session, sorted chronologically.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatId } = await params;

    if (!chatId) {
      return NextResponse.json({ error: 'Missing chat ID parameter' }, { status: 400 });
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json(messages);
  } catch (error: any) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/chats/[id]
 * Deletes a chat session (all child messages are deleted automatically via cascade).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatId } = await params;

    if (!chatId) {
      return NextResponse.json({ error: 'Missing chat ID parameter' }, { status: 400 });
    }

    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, deletedId: chatId });
  } catch (error: any) {
    console.error('Error deleting chat:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
