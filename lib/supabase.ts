'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// The project URL and publishable key are designed to be public: every request is
// still checked by Supabase Auth and the database's row level security policies.
export const SUPABASE_URL = 'https://yrqkafiqwllkphroztqk.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_C2z55xhqXzGgj9rqjkHj5g_uetKwEYC';

let client: SupabaseClient | undefined;

/** Browser Supabase client. Sessions live in secure cookies managed by @supabase/ssr. */
export function supabase(): SupabaseClient {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY,{cookieOptions:{secure:typeof window==='undefined'||window.location.protocol==='https:',sameSite:'lax',path:'/'}});
  return client;
}
