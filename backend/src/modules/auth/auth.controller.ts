import type { CookieOptions, RequestHandler } from 'express';
import type { EnvConfig } from '../../config/env';
import type { AuthService } from './auth.service';
import { AuthError } from './auth.types';

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
  return { login, logout, me };
}
