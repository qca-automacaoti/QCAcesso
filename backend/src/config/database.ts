import { createClient } from '@supabase/supabase-js';
import type { EnvConfig } from './env';
import type { Database } from './database.types';

export function createDatabase(config: EnvConfig, accessToken?: string) {
  // Um cliente por sessão: nunca compartilhar a identidade de dois usuários.
  return createClient<Database>(config.SUPABASE_URL, config.SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(12_000) }),
    },
  });
}
