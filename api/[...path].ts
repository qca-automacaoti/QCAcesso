/**
 * Ponto de entrada serverless (Vercel).
 *
 * O mesmo app Express usado localmente é exportado como handler. Diferenças do ambiente:
 * - as sessões vão para o banco (SupabaseSessionStore), porque a memória não persiste;
 * - os alertas não usam node-cron: são disparados por Vercel Cron em /api/cron/alertas.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../backend/src/app';
import { loadEnv } from '../backend/src/config/env';
import { createIdentityProvider } from '../backend/src/modules/auth/auth.provider';
import { AuthService } from '../backend/src/modules/auth/auth.service';
import { SupabaseSessionStore } from '../backend/src/modules/auth/session.store';

const config = loadEnv();
const provider = createIdentityProvider(config);
const auth = new AuthService(provider, config.SESSION_TTL_MS, new SupabaseSessionStore(config, provider));
const app = createApp(config, auth);

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(req, res);
}
