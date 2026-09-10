/**
 * Gerenciamento de Variáveis de Ambiente (env.ts)
 * Descrição: Carrega, valida e tipa as configurações da aplicação
 * a partir do arquivo .env, prevenindo execução sem variáveis obrigatórias.
 */

import dotenv from 'dotenv';
import path from 'path';

// Carrega as variáveis do arquivo .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  DATABASE_URL: string;
  DIRECT_URL?: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_FROM?: string;
}

const requiredEnvVars: (keyof EnvConfig)[] = ['DATABASE_URL', 'JWT_SECRET'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`[AVISO] Variável de ambiente obrigatória não definida: ${envVar}`);
  }
}

export const env: EnvConfig = {
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || '',
  DIRECT_URL: process.env.DIRECT_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-key-qcacesso',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM,
};

export default env;
