import { LocalBackend } from './local';
import { SupabaseBackend } from './supabase';
import type { Backend } from './backend';

// Supabase si configuré (.env.local), sinon mode local signalé à l'écran.
export function createBackend(): Backend {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return url && key ? new SupabaseBackend(url, key) : new LocalBackend();
}
export * from './backend';
