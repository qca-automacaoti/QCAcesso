/**
 * Disparo diário dos alertas no Vercel Cron (substitui o node-cron, que exige processo vivo).
 * Protegido por CRON_SECRET: o Vercel envia "Authorization: Bearer <CRON_SECRET>".
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createAdminDatabase } from '../../backend/src/config/database';
import { loadEnv } from '../../backend/src/config/env';
import { createMailer } from '../../backend/src/config/mailer';
import { executarRotinasAlertas } from '../../backend/src/jobs/alertas.scheduler';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.authorization !== `Bearer ${segredo}`) {
    res.statusCode = 401;
    res.end('Não autorizado.');
    return;
  }

  const config = loadEnv();
  if (!config.ALERTS_ENABLED) {
    res.statusCode = 200;
    res.end('Alertas desabilitados.');
    return;
  }

  try {
    const mailer = createMailer(config);
    await mailer.verify();
    await executarRotinasAlertas(createAdminDatabase(config), mailer, config);
    res.statusCode = 200;
    res.end('Rotinas de alerta executadas.');
  } catch (error) {
    console.error('Falha ao executar as rotinas de alerta:', error instanceof Error ? error.message : error);
    res.statusCode = 500;
    res.end('Falha ao executar as rotinas de alerta.');
  }
}
