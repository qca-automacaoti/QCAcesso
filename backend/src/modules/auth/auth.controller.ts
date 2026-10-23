import type { CookieOptions, RequestHandler } from 'express';
import type { EnvConfig } from '../../config/env';
import type { AuthService } from './auth.service';
import { AuthError } from './auth.types';
import { createDatabase } from '../../config/database';

export function cookieSettings(config: EnvConfig): { name: string; options: CookieOptions } {
  return {
    name: config.NODE_ENV === 'production' ? '__Host-qca_session' : 'qca_session',
    options: { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'strict', path: '/' },
  };
}

export function authController(service: AuthService, config: EnvConfig) {
  const cookie = cookieSettings(config);
  const login: RequestHandler = (req, res, next) => {
    const { email, senha } = req.body ?? {};
    if (typeof email !== 'string' || typeof senha !== 'string' ||
        email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        senha.length === 0 || senha.length > 256) {
      return next(new AuthError(400, 'DADOS_INVALIDOS', 'Informe um e-mail válido e sua senha.'));
    }
    void (async () => {
      const result = await service.login(email.trim().toLowerCase(), senha);
      await service.logout(req.cookies?.[cookie.name]);
      res.cookie(cookie.name, result.token, { ...cookie.options, maxAge: Math.max(0, result.expiresAt - Date.now()) });
      res.json({ usuario: result.usuario });
    })().catch(next);
  };
  const logout: RequestHandler = (req, res, next) => {
    res.clearCookie(cookie.name, cookie.options);
    service.logout(req.cookies?.[cookie.name]).then(() => { res.status(204).end(); }).catch(next);
  };
  const me: RequestHandler = (_req, res) => { res.json({ usuario: res.locals.usuario }); };
  const trocarSenha: RequestHandler = (req, res, next) => {
    const { senhaAtual, novaSenha } = req.body ?? {};
    if (typeof senhaAtual !== 'string' || typeof novaSenha !== 'string' ||
        senhaAtual.length === 0 || senhaAtual.length > 256 ||
        novaSenha.length < 8 || novaSenha.length > 128) {
      return next(new AuthError(400, 'DADOS_INVALIDOS', 'Informe a senha atual e uma nova senha de 8 a 128 caracteres.'));
    }
    if (novaSenha === senhaAtual) {
      return next(new AuthError(400, 'SENHA_REPETIDA', 'A nova senha precisa ser diferente da atual.'));
    }
    void (async () => {
      const usuario = await service.trocarSenha(req.cookies?.[cookie.name], senhaAtual, novaSenha);
      // Marca a senha como definitiva somente depois da troca ser aceita pelo provedor.
      const db = createDatabase(config, await service.accessToken(req.cookies?.[cookie.name]));
      const { error } = await (db as any).rpc('concluir_troca_senha');
      if (error) throw new AuthError(503, 'TROCA_INCOMPLETA', 'A senha foi alterada, mas o acesso não foi liberado. Entre novamente.');
      res.json({ usuario });
    })().catch(next);
  };
  return { login, logout, me, trocarSenha };
}
