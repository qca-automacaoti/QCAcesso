import type { RequestHandler } from 'express';
import type { EnvConfig } from '../../config/env';
import { createDatabase } from '../../config/database';
import type { AuthService } from '../auth/auth.service';
import { carregarDashboard } from './dashboard.service';

export function dashboardController(auth: AuthService, config: EnvConfig, cookieName: string) {
  const resumo: RequestHandler = (req, res, next) => {
    void (async () => {
      const accessToken = await auth.accessToken(req.cookies?.[cookieName]);
      const db = createDatabase(config, accessToken);
      res.json(await carregarDashboard(db));
    })().catch(next);
  };
  return { resumo };
}
