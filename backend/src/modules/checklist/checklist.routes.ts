import { Router } from 'express';
import type { EnvConfig } from '../../config/env';
import type { AuthService } from '../auth/auth.service';
import { cookieSettings } from '../auth/auth.controller';
import { requireAuth, requirePerfil } from '../auth/auth.middleware';
import { checklistController } from './checklist.controller';

export function checklistRoutes(auth: AuthService, config: EnvConfig) {
  const router = Router();
  const cookieName = cookieSettings(config).name;
  const controller = checklistController(auth, config, cookieName);
  const autenticar = [requireAuth(auth, cookieName)];
  const revisar = [requireAuth(auth, cookieName), requirePerfil('ADMIN', 'RH')];

  router.get('/', ...autenticar, controller.listar);
  router.post('/:id/editar', ...revisar, controller.editar);
  router.post('/:id/rejeitar', ...revisar, controller.rejeitar);
  router.post('/:id/confirmar', ...revisar, controller.confirmar);

  return router;
}
