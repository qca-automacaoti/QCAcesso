import type { RequestHandler } from 'express';
import type { EnvConfig } from '../../config/env';
import { createDatabase } from '../../config/database';
import type { AuthService } from '../auth/auth.service';
import { AuthError } from '../auth/auth.types';
import { carregarDashboard } from './dashboard.service';

export function dashboardController(auth: AuthService, config: EnvConfig, cookieName: string) {
  const resumo: RequestHandler = (req, res, next) => {
    void (async () => {
      const atividadeOffset = typeof req.query.atividadeOffset === 'string' ? Number(req.query.atividadeOffset) : 0;
      const acoesOffset = typeof req.query.acoesOffset === 'string' ? Number(req.query.acoesOffset) : 0;
      if (!Number.isSafeInteger(atividadeOffset) || atividadeOffset < 0 || atividadeOffset > 100_000 || !Number.isSafeInteger(acoesOffset) || acoesOffset < 0 || acoesOffset > 100_000) throw new AuthError(400, 'PAGINACAO_INVALIDA', 'Paginação inválida.');
      const accessToken = await auth.accessToken(req.cookies?.[cookieName]);
      const db = createDatabase(config, accessToken);
      res.json(await carregarDashboard(db, atividadeOffset, acoesOffset));
    })().catch(next);
  };
  return { resumo };
}
