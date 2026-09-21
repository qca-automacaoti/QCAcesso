import { Router } from 'express';
import type { EnvConfig } from '../../config/env';
import type { AuthService } from '../auth/auth.service';
import { cookieSettings } from '../auth/auth.controller';
import { requireAuth, requirePerfil } from '../auth/auth.middleware';
import { configuracoesController } from './configuracoes.controller';

export function configuracoesRoutes(auth: AuthService, config: EnvConfig) {
  const router = Router();
  const cookieName = cookieSettings(config).name;
  const controller = configuracoesController(auth, config, cookieName);
  router.get('/email', requireAuth(auth, cookieName), requirePerfil('ADMIN', 'SUPERVISOR'), controller.obterEmail);
  router.patch('/email', requireAuth(auth, cookieName), requirePerfil('ADMIN', 'SUPERVISOR'), controller.salvarEmail);
  router.post('/email/teste', requireAuth(auth, cookieName), requirePerfil('ADMIN', 'SUPERVISOR'), controller.testarEmail);
  return router;
}
