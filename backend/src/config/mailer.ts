import nodemailer from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import MailComposer from 'nodemailer/lib/mail-composer';
import type { EnvConfig } from './env';

export type Mailer = Pick<nodemailer.Transporter, 'verify' | 'sendMail'>;

export function createMailer(config: EnvConfig): Mailer {
  if (config.GMAIL_USER && config.GMAIL_OAUTH_CLIENT_FILE && config.GMAIL_OAUTH_TOKEN_FILE) {
    const resolveBackendPath = (value: string) => path.isAbsolute(value) ? value : path.resolve(__dirname, '../..', value);
    const clientFile = JSON.parse(fs.readFileSync(resolveBackendPath(config.GMAIL_OAUTH_CLIENT_FILE), 'utf8'));
    const tokenFile = JSON.parse(fs.readFileSync(resolveBackendPath(config.GMAIL_OAUTH_TOKEN_FILE), 'utf8'));
    const credentials = clientFile.installed || clientFile.web;
    if (!credentials?.client_id || !credentials?.client_secret || !tokenFile.refresh_token) {
      throw new Error('Credenciais OAuth2 do Gmail incompletas.');
    }
    const auth = new google.auth.OAuth2(credentials.client_id, credentials.client_secret);
    auth.setCredentials({ refresh_token: tokenFile.refresh_token });
    const gmail = google.gmail({ version: 'v1', auth });
    return {
      async verify() {
        await auth.getAccessToken();
        return true as const;
      },
      async sendMail(message) {
        const rawMessage = await new MailComposer(message).compile().build();
        const raw = rawMessage.toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/g, '');
        return gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
      },
    };
  }
  if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS) {
    throw new Error('Configuração de e-mail ausente.');
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
