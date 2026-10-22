/**
 * Rotas de Férias da Tecnologia (tecnologia.routes.ts)
 * Descrição: Expõe o calendário de férias da TI para os perfis Tecnologia, Supervisão e
 * Administração, restringindo o cadastro e o cancelamento a Administração e Supervisão.
 */
import { Router } from 'express';
import type { EnvConfig } from '../../config/env';
import type { AuthService } from '../auth/auth.service';
import { cookieSettings } from '../auth/auth.controller';
import { requireAuth, requirePerfil } from '../auth/auth.middleware';
import { tecnologiaController } from './tecnologia.controller';

export function tecnologiaRoutes(auth: AuthService, config: EnvConfig) {
  const router = Router();
  const cookieName = cookieSettings(config).name;
  const controller = tecnologiaController(auth, config, cookieName);
  router.get('/ferias', requireAuth(auth, cookieName), requirePerfil('ADMIN', 'SUPERVISOR', 'TECNOLOGIA'), controller.listar);
  router.post('/ferias', requireAuth(auth, cookieName), requirePerfil('ADMIN', 'SUPERVISOR'), controller.cadastrar);
  router.patch('/ferias/:id/cancelamento', requireAuth(auth, cookieName), requirePerfil('ADMIN', 'SUPERVISOR'), controller.cancelar);
  return router;
}
