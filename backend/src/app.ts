import express from 'express';
import type { ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { EnvConfig } from './config/env';
import { authRoutes } from './modules/auth/auth.routes';
import { cookieSettings } from './modules/auth/auth.controller';
import { AuthError } from './modules/auth/auth.types';
import type { AuthService } from './modules/auth/auth.service';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { uploadRoutes } from './modules/upload/upload.routes';
import { checklistRoutes } from './modules/checklist/checklist.routes';
import { controleAcessoRoutes } from './modules/controle-acesso/controle-acesso.routes';
import { usuariosRoutes } from './modules/usuarios/usuarios.routes';
import { auditoriaRoutes } from './modules/auditoria/auditoria.routes';

export function createApp(config: EnvConfig, auth: AuthService) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use(cors({ origin: config.FRONTEND_ORIGIN, credentials: true, methods: ['GET', 'POST', 'PATCH'] }));
  app.use(cookieParser());
  app.use((req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const uploadMultipart = req.method === 'POST' && req.path === '/api/uploads' && Boolean(req.is('multipart/form-data'));
      if ((req.get('Origin') && req.get('Origin') !== config.FRONTEND_ORIGIN) ||
          req.get('Sec-Fetch-Site') === 'cross-site' || req.get('X-QCA-Request') !== '1') {
        return next(new AuthError(403, 'ORIGEM_NAO_PERMITIDA', 'Origem da requisição não permitida.'));
      }
      if (!uploadMultipart && !req.is('application/json')) return next(new AuthError(415, 'FORMATO_INVALIDO', 'Envie os dados em formato JSON.'));
    }
    next();
  });
  app.use(express.json({ limit: '8kb' }));
  app.get('/api/health', (_req, res) => {
    auth.health().then(() => res.json({ status: 'ok', database: 'connected' }))
      .catch(() => res.status(503).json({ status: 'unavailable', database: 'unavailable' }));
  });
  app.use('/api/auth', authRoutes(auth, config));
  app.use('/api/dashboard', dashboardRoutes(auth, config));
  app.use('/api/uploads', uploadRoutes(auth, config));
  app.use('/api/checklist', checklistRoutes(auth, config));
  app.use('/api/controle-acesso', controleAcessoRoutes(auth, config));
  app.use('/api/usuarios', usuariosRoutes(auth, config));
  app.use('/api/auditoria', auditoriaRoutes(auth, config));
  app.use((_req, res) => { res.status(404).json({ error: { code: 'NAO_ENCONTRADO', message: 'Rota não encontrada.' } }); });
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof AuthError) {
      if ([401, 403].includes(error.status) && error.code !== 'ORIGEM_NAO_PERMITIDA' && error.code !== 'PERFIL_NAO_PERMITIDO') {
        const cookie = cookieSettings(config);
        res.clearCookie(cookie.name, cookie.options);
      }
      res.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    if (error?.type === 'entity.parse.failed' || error?.type === 'entity.too.large') {
      res.status(400).json({ error: { code: 'DADOS_INVALIDOS', message: 'Corpo da requisição inválido.' } });
      return;
    }
    // Não registrar objetos de erro do provedor: podem conter tokens ou credenciais.
    console.error('Falha interna ao processar uma requisição.');
    res.status(500).json({ error: { code: 'ERRO_INTERNO', message: 'Não foi possível concluir a solicitação. Tente novamente.' } });
  };
  app.use(errorHandler);
  return app;
}
