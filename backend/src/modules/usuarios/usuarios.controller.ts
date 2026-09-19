import type { RequestHandler } from 'express';
import type { EnvConfig } from '../../config/env';
import { createDatabase } from '../../config/database';
import type { PerfilUsuario, UsuarioAutenticado } from '../auth/auth.types';
import { AuthError } from '../auth/auth.types';
import type { AuthService } from '../auth/auth.service';
import { atualizarUsuario, listarUsuarios } from './usuarios.service';

const perfis: PerfilUsuario[] = ['ADMIN', 'RH', 'SUPERVISOR', 'AUDITOR'];

export function usuariosController(auth: AuthService, config: EnvConfig, cookieName: string) {
  async function db(req: Parameters<RequestHandler>[0]) {
    return createDatabase(config, await auth.accessToken(req.cookies?.[cookieName]));
  }
  const listar: RequestHandler = (req, res, next) => {
    void (async () => {
      const offset = typeof req.query.offset === 'string' ? Number(req.query.offset) : 0;
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100_000) throw new AuthError(400, 'PAGINACAO_INVALIDA', 'Paginação inválida.');
      const busca = typeof req.query.busca === 'string' ? req.query.busca.slice(0, 100) : '';
      res.json(await listarUsuarios(await db(req), busca, offset));
    })().catch(next);
  };
  const atualizar: RequestHandler = (req, res, next) => {
    void (async () => {
      const perfil = String(req.body?.perfil ?? '').toUpperCase() as PerfilUsuario;
      const ativo = req.body?.ativo;
      if (!perfis.includes(perfil) || typeof ativo !== 'boolean') throw new AuthError(400, 'DADOS_INVALIDOS', 'Informe um perfil e um status válido.');
      const item = await atualizarUsuario(await db(req), res.locals.usuario as UsuarioAutenticado, String(req.params.id ?? ''), { perfil, ativo });
      res.json({ item });
    })().catch(next);
  };
  return { listar, atualizar };
}
