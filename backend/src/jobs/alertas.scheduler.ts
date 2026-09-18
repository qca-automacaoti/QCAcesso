import cron from 'node-cron';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../config/database.types';
import type { EnvConfig } from '../config/env';
import type { createMailer } from '../config/mailer';
import { verificarAtrasos } from './verificar-atrasos.job';
import { verificarBloqueios } from './verificar-bloqueios.job';
import { verificarDesbloqueios } from './verificar-desbloqueios.job';

export function iniciarJobsAlertas(
  db: SupabaseClient<Database>,
  mailer: ReturnType<typeof createMailer>,
  config: EnvConfig,
) {
  let emExecucao = false;
  const executarRotinas = async () => {
    if (emExecucao) return;
    emExecucao = true;
    const rotinas = [
      ['lembretes de bloqueio', () => verificarBloqueios(db, mailer, config)],
      ['lembretes de desbloqueio', () => verificarDesbloqueios(db, mailer, config)],
      ['escalonamento de atrasos', () => verificarAtrasos(db, mailer, config)],
    ] as const;
    try {
      for (const [nome, executar] of rotinas) {
        try { await executar(); }
        catch { console.error(`Falha na rotina diária de ${nome}.`); }
      }
    } finally {
      emExecucao = false;
    }
  };
  const job = cron.schedule('0 8 * * *', () => { void executarRotinas(); }, { timezone: config.ALERTS_TIMEZONE });
  void executarRotinas(); // Recupera o ciclo diário caso o backend tenha reiniciado depois do horário agendado.

  return () => job.stop();
}
