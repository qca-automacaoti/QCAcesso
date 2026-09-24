import type { RequestHandler } from 'express';
import type { EnvConfig } from '../../config/env';
import { createDatabase } from '../../config/database';
import type { AuthService } from '../auth/auth.service';
import type { UsuarioAutenticado } from '../auth/auth.types';
import { AuthError } from '../auth/auth.types';
import { importarPlanilha, listarUploads, parseMultipartFile } from './upload.service';

export function uploadController(auth: AuthService, config: EnvConfig, cookieName: string) {
  const listar: RequestHandler = (req, res, next) => {
    void (async () => {
      const offset = typeof req.query.offset === 'string' ? Number(req.query.offset) : 0;
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100_000) throw new AuthError(400, 'PAGINACAO_INVALIDA', 'Paginação inválida.');
      const accessToken = await auth.accessToken(req.cookies?.[cookieName]);
      const listagem = await listarUploads(createDatabase(config, accessToken), offset);
      res.json({ uploads: listagem.itens, total: listagem.total });
    })().catch(next);
  };

  const importar: RequestHandler = (req, res, next) => {
    void (async () => {
      const usuario = res.locals.usuario as UsuarioAutenticado;
      const file = parseMultipartFile(req.get('content-type'), Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0));
      const accessToken = await auth.accessToken(req.cookies?.[cookieName]);
      const resultado = await importarPlanilha(createDatabase(config, accessToken), usuario, file);
      res.status(201).json(resultado);
    })().catch(next);
  };

  return { listar, importar };
}
