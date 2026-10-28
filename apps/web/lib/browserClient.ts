'use client';
import { createBrowserClient } from '@supabase/ssr';

// Browser client with the public anon key only. User data is protected by RLS.
export function browserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || key.length < 20) return null;
  return createBrowserClient(url, key);
}
