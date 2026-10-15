/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

export function createSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) {
    throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env, then restart the dev server.');
  }
  return createClient(url, key);
}
