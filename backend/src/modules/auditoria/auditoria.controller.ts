import type { RequestHandler } from 'express';
import type { EnvConfig } from '../../config/env';
import { createDatabase } from '../../config/database';
import type { AuthService } from '../auth/auth.service';
import { AuthError } from '../auth/auth.types';
import { listarAuditoria, tipoAuditoriaValido } from './auditoria.service';

export function auditoriaController(auth: AuthService, config: EnvConfig, cookieName: string) {
  const listar: RequestHandler = (req, res, next) => {
    void (async () => {
      const tipo = typeof req.query.tipo === 'string' ? req.query.tipo.toUpperCase() : undefined;
      if (tipo && !tipoAuditoriaValido(tipo)) throw new AuthError(400, 'TIPO_INVALIDO', 'Tipo de evento inválido.');
      const offset = typeof req.query.offset === 'string' ? Number(req.query.offset) : 0;
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100_000) throw new AuthError(400, 'PAGINACAO_INVALIDA', 'Paginação inválida.');
      const token = await auth.accessToken(req.cookies?.[cookieName]);
      res.json(await listarAuditoria(createDatabase(config, token), { tipo: tipo as any, busca: typeof req.query.busca === 'string' ? req.query.busca.slice(0, 100) : undefined, inicio: typeof req.query.inicio === 'string' ? req.query.inicio : undefined, fim: typeof req.query.fim === 'string' ? req.query.fim : undefined, offset }));
    })().catch(next);
  };
  return { listar };
}
