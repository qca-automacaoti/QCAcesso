import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { EnvConfig } from '../../config/env';
import type { AuthService } from './auth.service';
import { authController, cookieSettings } from './auth.controller';
import { requireAuth, requirePerfil } from './auth.middleware';
import { PERFIS } from './auth.types';

export function authRoutes(service: AuthService, config: EnvConfig) {
  const router = Router();
  const controller = authController(service, config);
  router.post('/login', rateLimit({
    windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: { code: 'MUITAS_TENTATIVAS', message: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' } },
  }), controller.login);
  router.post('/logout', controller.logout);
  const cookieName = cookieSettings(config).name;
  // /me e a troca de senha continuam acessíveis com senha provisória: são o caminho
  // que o usuário precisa percorrer para liberar o próprio acesso.
  router.get('/me', requireAuth(service, cookieName, { permitirSenhaProvisoria: true }), requirePerfil(...PERFIS), controller.me);
  router.post('/senha', rateLimit({
    windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: { code: 'MUITAS_TENTATIVAS', message: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' } },
  }), requireAuth(service, cookieName, { permitirSenhaProvisoria: true }), requirePerfil(...PERFIS), controller.trocarSenha);
  return router;
}
