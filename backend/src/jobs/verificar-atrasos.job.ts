import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../config/database.types';
import type { createMailer } from '../config/mailer';
import type { EnvConfig } from '../config/env';
import { escalarAtrasos } from '../modules/alertas/alertas.service';

export function verificarAtrasos(db: SupabaseClient<Database>, mailer: ReturnType<typeof createMailer>, config: EnvConfig) {
  return escalarAtrasos(db, mailer, {
    timezone: config.ALERTS_TIMEZONE,
    fromEmail: config.ALERTS_FROM_EMAIL!,
    frontendOrigin: config.FRONTEND_ORIGIN,
  });
}
