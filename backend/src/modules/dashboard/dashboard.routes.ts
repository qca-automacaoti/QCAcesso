import { Router } from 'express';
import type { EnvConfig } from '../../config/env';
import type { AuthService } from '../auth/auth.service';
import { cookieSettings } from '../auth/auth.controller';
import { requireAuth, requirePerfil } from '../auth/auth.middleware';
import { PERFIS } from '../auth/auth.types';
import { dashboardController } from './dashboard.controller';

export function dashboardRoutes(auth: AuthService, config: EnvConfig) {
  const router = Router();
  const cookieName = cookieSettings(config).name;
  const controller = dashboardController(auth, config, cookieName);
  router.get('/', requireAuth(auth, cookieName), requirePerfil(...PERFIS), controller.resumo);
  return router;
}
