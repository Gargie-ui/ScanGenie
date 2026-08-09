import { NextRequest } from 'next/server';
import { supabase } from './supabase';

/**
 * Extracts the user ID from the Authorization header of an incoming request.
 * Verifies the JWT via Supabase Auth and returns the user's UUID.
 * Returns null for guests (no token or invalid token).
 */
export async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.slice(7);
    if (!token) return null;

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    return user.id;
  } catch {
    return null;
  }
}
