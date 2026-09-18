import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../config/database.types';
import type { createMailer } from '../config/mailer';
import type { EnvConfig } from '../config/env';
import { enviarLembretesDesbloqueio } from '../modules/alertas/alertas.service';

export function verificarDesbloqueios(db: SupabaseClient<Database>, mailer: ReturnType<typeof createMailer>, config: EnvConfig) {
  return enviarLembretesDesbloqueio(db, mailer, {
    timezone: config.ALERTS_TIMEZONE,
    fromEmail: config.ALERTS_FROM_EMAIL!,
    frontendOrigin: config.FRONTEND_ORIGIN,
  });
}
