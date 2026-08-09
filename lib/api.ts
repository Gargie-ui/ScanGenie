'use client';

import { supabaseBrowser } from './supabaseClient';

/**
 * Authenticated fetch wrapper.
 * Automatically attaches the Supabase access token as a Bearer token
 * in the Authorization header. For guests (no session), sends the
 * request without an auth header.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);

  try {
    const { data: { session } } = await supabaseBrowser.auth.getSession();
    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`);
    }
  } catch {
    // If Supabase client isn't configured, proceed without auth header
  }

  return fetch(url, { ...options, headers });
}
