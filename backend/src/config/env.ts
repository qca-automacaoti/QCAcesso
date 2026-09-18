import dotenv from 'dotenv';
import path from 'node:path';

export interface EnvConfig {
  PORT: number;
  NODE_ENV: 'development' | 'test' | 'production';
  FRONTEND_ORIGIN: string;
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  SESSION_TTL_MS: number;
  ALERTS_ENABLED: boolean;
  ALERTS_TIMEZONE: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SMTP_HOST?: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  ALERTS_FROM_EMAIL?: string;
}

export function loadEnv(): EnvConfig {
  dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
  const mode = process.env.NODE_ENV || 'development';
  if (!['development', 'test', 'production'].includes(mode)) throw new Error('NODE_ENV inválido.');
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!url || !key || /SEU_PROJETO|SUBSTITUA/.test(url + key)) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY (ou SUPABASE_ANON_KEY) em backend/.env.');
  }
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== 'https:' && !(mode !== 'production' && ['localhost', '127.0.0.1'].includes(parsedUrl.hostname))) {
    throw new Error('SUPABASE_URL deve usar HTTPS.');
  }
  // Uma chave administrativa ignoraria RLS; a aplicação usa somente chave pública.
  let keyRole: unknown;
  if (key.split('.').length === 3) {
    try { keyRole = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; }
    catch { throw new Error('SUPABASE_ANON_KEY inválida.'); }
  }
  if (key.startsWith('sb_secret_') || keyRole === 'service_role') {
    throw new Error('Use uma chave publishable/anon, nunca secret/service_role no login.');
  }
  const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
  if (new URL(origin).origin !== origin) throw new Error('FRONTEND_ORIGIN deve conter somente a origem, sem caminho ou barra final.');
  if (mode === 'production' && !origin.startsWith('https://')) throw new Error('FRONTEND_ORIGIN deve usar HTTPS em produção.');
  const port = Number(process.env.PORT || 3000);
  const hours = Number(process.env.SESSION_TTL_HOURS || 8);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida.');
  if (!Number.isFinite(hours) || hours < 0.01 || hours > 24) throw new Error('SESSION_TTL_HOURS deve ser maior ou igual a 0.01 e até 24.');

  const alertsEnabledRaw = process.env.ALERTS_ENABLED || 'false';
  if (!['true', 'false'].includes(alertsEnabledRaw.toLowerCase())) throw new Error('ALERTS_ENABLED deve ser true ou false.');
  const alertsEnabled = alertsEnabledRaw.toLowerCase() === 'true';
  const timezone = process.env.ALERTS_TIMEZONE || 'America/Sao_Paulo';
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); }
  catch { throw new Error('ALERTS_TIMEZONE inválido.'); }
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) throw new Error('SMTP_PORT inválida.');
  const smtpSecureRaw = process.env.SMTP_SECURE || (smtpPort === 465 ? 'true' : 'false');
  if (!['true', 'false'].includes(smtpSecureRaw.toLowerCase())) throw new Error('SMTP_SECURE deve ser true ou false.');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromEmail = process.env.ALERTS_FROM_EMAIL;
  if (alertsEnabled) {
    let serviceKeyRole: unknown;
    if (serviceRoleKey?.split('.').length === 3) {
      try { serviceKeyRole = JSON.parse(Buffer.from(serviceRoleKey.split('.')[1], 'base64url').toString()).role; }
      catch { throw new Error('SUPABASE_SERVICE_ROLE_KEY inválida.'); }
    }
    if (!serviceRoleKey || /SUBSTITUA|SEU_PROJETO/.test(serviceRoleKey) || !(serviceRoleKey.startsWith('sb_secret_') || serviceKeyRole === 'service_role')) {
      throw new Error('Configure uma SUPABASE_SERVICE_ROLE_KEY exclusiva para os jobs automáticos.');
    }
    if (!smtpHost || !smtpUser || !smtpPass || !fromEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
      throw new Error('Configure SMTP_HOST, SMTP_USER, SMTP_PASS e ALERTS_FROM_EMAIL para ativar os alertas.');
    }
  }
  return {
    PORT: port, NODE_ENV: mode as EnvConfig['NODE_ENV'], FRONTEND_ORIGIN: origin,
    SUPABASE_URL: parsedUrl.origin, SUPABASE_KEY: key, SESSION_TTL_MS: hours * 60 * 60 * 1000,
    ALERTS_ENABLED: alertsEnabled,
    ALERTS_TIMEZONE: timezone,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    SMTP_HOST: smtpHost,
    SMTP_PORT: smtpPort,
    SMTP_SECURE: smtpSecureRaw.toLowerCase() === 'true',
    SMTP_USER: smtpUser,
    SMTP_PASS: smtpPass,
    ALERTS_FROM_EMAIL: fromEmail,
  };
}
