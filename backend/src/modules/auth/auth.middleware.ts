import type { RequestHandler } from 'express';
import type { AuthService } from './auth.service';
import type { PerfilUsuario, UsuarioAutenticado } from './auth.types';
import { AuthError } from './auth.types';

export function requireAuth(service: AuthService, cookieName: string): RequestHandler {
  return (req, res, next) => {
    service.currentUser(req.cookies?.[cookieName]).then((usuario) => {
      res.locals.usuario = usuario;
      next();
    }).catch(next);
  };
}

export function requirePerfil(...perfis: PerfilUsuario[]): RequestHandler {
  return (_req, res, next) => {
    const usuario = res.locals.usuario as UsuarioAutenticado | undefined;
    if (!usuario) return next(new AuthError(401, 'NAO_AUTENTICADO', 'Entre na sua conta para continuar.'));
    if (!perfis.includes(usuario.perfil)) return next(new AuthError(403, 'PERFIL_NAO_PERMITIDO', 'Seu perfil não tem permissão para acessar este recurso.'));
    next();
  };
}
