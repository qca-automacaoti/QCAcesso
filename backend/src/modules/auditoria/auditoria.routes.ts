import { Router } from 'express';
import type { EnvConfig } from '../../config/env';
import type { AuthService } from '../auth/auth.service';
import { cookieSettings } from '../auth/auth.controller';
import { requireAuth, requirePerfil } from '../auth/auth.middleware';
import { auditoriaController } from './auditoria.controller';

export function auditoriaRoutes(auth: AuthService, config: EnvConfig) {
  const router = Router();
  const cookieName = cookieSettings(config).name;
  router.get('/', requireAuth(auth, cookieName), requirePerfil('ADMIN', 'RH', 'AUDITOR'), auditoriaController(auth, config, cookieName).listar);
  return router;
}
