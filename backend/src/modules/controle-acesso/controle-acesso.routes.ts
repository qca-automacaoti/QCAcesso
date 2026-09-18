import { Router } from 'express';
import type { EnvConfig } from '../../config/env';
import type { AuthService } from '../auth/auth.service';
import { cookieSettings } from '../auth/auth.controller';
import { requireAuth, requirePerfil } from '../auth/auth.middleware';
import { PERFIS } from '../auth/auth.types';
import { controleAcessoController } from './controle-acesso.controller';

export function controleAcessoRoutes(auth: AuthService, config: EnvConfig) {
  const router = Router();
  const cookieName = cookieSettings(config).name;
  const controller = controleAcessoController(auth, config, cookieName);

  router.get('/', requireAuth(auth, cookieName), requirePerfil(...PERFIS), controller.listar);
  router.post('/:id/confirmar', requireAuth(auth, cookieName), requirePerfil('ADMIN', 'RH', 'SUPERVISOR'), controller.confirmar);

  return router;
}
