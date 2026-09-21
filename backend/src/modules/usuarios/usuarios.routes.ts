import { Router } from 'express';
import type { EnvConfig } from '../../config/env';
import type { AuthService } from '../auth/auth.service';
import { cookieSettings } from '../auth/auth.controller';
import { requireAuth, requirePerfil } from '../auth/auth.middleware';
import { usuariosController } from './usuarios.controller';

export function usuariosRoutes(auth: AuthService, config: EnvConfig) {
  const router = Router();
  const cookieName = cookieSettings(config).name;
  const controller = usuariosController(auth, config, cookieName);
  router.get('/', requireAuth(auth, cookieName), requirePerfil('ADMIN', 'SUPERVISOR'), controller.listar);
  router.post('/', requireAuth(auth, cookieName), requirePerfil('ADMIN'), controller.criar);
  router.patch('/:id', requireAuth(auth, cookieName), requirePerfil('ADMIN'), controller.atualizar);
  return router;
}
