import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUserIdFromRequest } from '@/lib/auth';

/**
 * GET /api/chats
 * Lists all chat sessions for the authenticated user, ordered by creation date descending.
 * Guests see chats with user_id = NULL.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);

    let query = supabase
      .from('chats')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.is('user_id', null);
    }

    const { data: chats, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json(chats);
  } catch (error: any) {
    console.error('Error fetching chats:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/chats
 * Creates a new chat session scoped to the authenticated user.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const title = body.title || 'Naming...';

    const { data: chat, error } = await supabase
      .from('chats')
      .insert({ title, user_id: userId })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(chat);
  } catch (error: any) {
    console.error('Error creating chat:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
