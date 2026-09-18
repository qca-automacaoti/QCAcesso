import nodemailer from 'nodemailer';
import type { EnvConfig } from './env';

export function createMailer(config: EnvConfig) {
  if (!config.ALERTS_ENABLED || !config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS || !config.ALERTS_FROM_EMAIL) {
    throw new Error('Configuração SMTP ausente.');
  }
  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}
