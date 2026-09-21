import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../config/database.types';
import type { EnvConfig } from '../../config/env';
import { createMailer } from '../../config/mailer';
import { AuthError } from '../auth/auth.types';
import { renderizarAlerta, type EmailTemplateConfig } from '../alertas/email.templates';

type Db = SupabaseClient<Database>;

export interface ConfiguracaoEmail extends EmailTemplateConfig {
  id: string;
  atualizadoPor: string | null;
  atualizadoEm: string;
}

export async function obterConfiguracaoEmail(db: Db): Promise<ConfiguracaoEmail> {
  const { data, error } = await (db as any).from('configuracao_email').select('id,assunto,mensagem,atualizado_por,updated_at').eq('id', 'global').maybeSingle();
  if (error) throw new Error('Não foi possível carregar a configuração de e-mail.');
  if (!data) return { id: 'global', assunto: 'QCAcesso | {{tipoAlerta}} - {{nome}}', mensagem: 'Olá,\n\n{{chamada}}\n\nFuncionário: {{nome}}\nEmpresa: {{empresa}}\nCadastro: {{cadastro}}\n\nAcesse o QCAcesso: {{link}}', atualizadoPor: null, atualizadoEm: new Date(0).toISOString() };
  return { id: data.id, assunto: data.assunto, mensagem: data.mensagem, atualizadoPor: data.atualizado_por, atualizadoEm: data.updated_at };
}

export async function salvarConfiguracaoEmail(db: Db, atualizadorId: string, input: EmailTemplateConfig) {
  const assunto = input.assunto.trim();
  const mensagem = input.mensagem.trim();
  if (assunto.length < 3 || assunto.length > 180 || mensagem.length < 10 || mensagem.length > 10000) {
    throw new AuthError(400, 'DADOS_INVALIDOS', 'Informe um assunto (3 a 180 caracteres) e uma mensagem (10 a 10.000 caracteres).');
  }
  const { data, error } = await (db as any).rpc('salvar_configuracao_email', { p_assunto: assunto, p_mensagem: mensagem });
  if (error || !data) throw new Error('Não foi possível salvar a configuração de e-mail.');
  return { id: data.id, assunto: data.assunto, mensagem: data.mensagem, atualizadoPor: data.atualizado_por ?? atualizadorId, atualizadoEm: data.updated_at } as ConfiguracaoEmail;
}

const exemplo = {
  tipoAlerta: 'LEMBRETE_BLOQUEIO' as const, tipoAcao: 'BLOQUEIO' as const,
  nome: 'Maria de Exemplo', empresa: 'QCA Recife', cadastro: '000123',
  dataProgramada: '2099-12-15', dataInicio: '2099-12-15', dataFim: '2099-12-30',
  urlControle: 'https://qacesso.exemplo/app/controle-acesso',
};

export async function enviarEmailTeste(config: EnvConfig, template: EmailTemplateConfig, destinatario: string) {
  if (!/^\S+@\S+\.\S+$/.test(destinatario)) throw new AuthError(400, 'EMAIL_INVALIDO', 'Informe um endereço de e-mail válido.');
  const smtpConfigured = Boolean(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS);
  const gmailConfigured = Boolean(config.GMAIL_USER && config.GMAIL_OAUTH_CLIENT_FILE && config.GMAIL_OAUTH_TOKEN_FILE);
  if ((!smtpConfigured && !gmailConfigured) || !config.ALERTS_FROM_EMAIL) {
    throw new AuthError(503, 'EMAIL_NAO_CONFIGURADO', 'Configure o Gmail OAuth2 ou o SMTP no backend antes de enviar um teste.');
  }
  const email = renderizarAlerta(exemplo, template);
  await createMailer(config).sendMail({ from: config.ALERTS_FROM_EMAIL, to: destinatario, ...email });
}
