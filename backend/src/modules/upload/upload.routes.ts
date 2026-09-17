import express, { Router } from 'express';
import type { EnvConfig } from '../../config/env';
import type { AuthService } from '../auth/auth.service';
import { cookieSettings } from '../auth/auth.controller';
import { requireAuth, requirePerfil } from '../auth/auth.middleware';
import { PERFIS } from '../auth/auth.types';
import { uploadController } from './upload.controller';

export function uploadRoutes(auth: AuthService, config: EnvConfig) {
  const router = Router();
  const cookieName = cookieSettings(config).name;
  const controller = uploadController(auth, config, cookieName);
  const autenticar = [requireAuth(auth, cookieName), requirePerfil(...PERFIS)];

  router.get('/', ...autenticar, controller.listar);
  router.post('/', ...autenticar, express.raw({ type: 'multipart/form-data', limit: '5mb' }), controller.importar);

  return router;
}
