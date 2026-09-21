import type { RequestHandler } from 'express';
import type { EnvConfig } from '../../config/env';
import { createDatabase } from '../../config/database';
import type { AuthService } from '../auth/auth.service';
import type { UsuarioAutenticado } from '../auth/auth.types';
import { enviarEmailTeste, obterConfiguracaoEmail, salvarConfiguracaoEmail } from './configuracoes.service';

export function configuracoesController(auth: AuthService, config: EnvConfig, cookieName: string) {
  async function db(req: Parameters<RequestHandler>[0]) { return createDatabase(config, await auth.accessToken(req.cookies?.[cookieName])); }
  const obterEmail: RequestHandler = (req, res, next) => { void (async () => { res.json({ item: await obterConfiguracaoEmail(await db(req)) }); })().catch(next); };
  const salvarEmail: RequestHandler = (req, res, next) => { void (async () => {
    const assunto = typeof req.body?.assunto === 'string' ? req.body.assunto : '';
    const mensagem = typeof req.body?.mensagem === 'string' ? req.body.mensagem : '';
    const item = await salvarConfiguracaoEmail(await db(req), (res.locals.usuario as UsuarioAutenticado).id, { assunto, mensagem });
    res.json({ item });
  })().catch(next); };
  const testarEmail: RequestHandler = (req, res, next) => { void (async () => {
    const destinatario = String(req.body?.destinatario ?? '').trim();
    const template = await obterConfiguracaoEmail(await db(req));
    await enviarEmailTeste(config, template, destinatario);
    const usuario = res.locals.usuario as UsuarioAutenticado;
    await (await db(req) as any).from('logs_atividade').insert({ usuario_id: usuario.id, tipo_evento: 'CONFIGURACAO_ALTERADA', entidade_afetada: 'configuracao_email', descricao: `E-mail de teste enviado para ${destinatario}.` });
    res.json({ ok: true, mensagem: `E-mail de teste enviado para ${destinatario}.` });
  })().catch(next); };
  return { obterEmail, salvarEmail, testarEmail };
}
