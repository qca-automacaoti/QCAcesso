import type { RequestHandler } from 'express';
import type { AuthService } from './auth.service';
import type { PerfilUsuario, UsuarioAutenticado } from './auth.types';
import { AuthError } from './auth.types';

/**
 * Exige sessão válida. Enquanto a senha for provisória, o acesso fica retido: somente
 * as rotas da própria troca de senha passam `permitirSenhaProvisoria`.
 */
export function requireAuth(
  service: AuthService,
  cookieName: string,
  options: { permitirSenhaProvisoria?: boolean } = {},
): RequestHandler {
  return (req, res, next) => {
    service.currentUser(req.cookies?.[cookieName]).then((usuario) => {
      if (usuario.deveTrocarSenha && !options.permitirSenhaProvisoria) {
        return next(new AuthError(403, 'SENHA_PROVISORIA', 'Defina uma nova senha para continuar usando o sistema.'));
      }
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
