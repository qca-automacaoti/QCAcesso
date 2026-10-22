import { createApp } from './app';
import { createAdminDatabase } from './config/database';
import { loadEnv } from './config/env';
import { createMailer } from './config/mailer';
import { createIdentityProvider } from './modules/auth/auth.provider';
import { AuthService } from './modules/auth/auth.service';
import { iniciarJobsAlertas } from './jobs/alertas.scheduler';

async function iniciarServidor() {
  const config = loadEnv();
  let pararJobs: () => void = () => {};

  // Os alertas são um recurso acessório: uma falha de e-mail não pode impedir a API de subir.
  if (config.ALERTS_ENABLED) {
    try {
      const mailer = createMailer(config);
      await mailer.verify();
      pararJobs = iniciarJobsAlertas(createAdminDatabase(config), mailer, config);
      console.log('Alertas automáticos habilitados: execução na inicialização e diariamente às 08:00.');
    } catch (error) {
      const motivo = error instanceof Error ? error.message : 'falha ao configurar o envio de e-mail.';
      console.warn('Alertas automáticos desabilitados (' + motivo + '). A API continua disponível.');
    }
  }

  const auth = new AuthService(createIdentityProvider(config), config.SESSION_TTL_MS);
  const server = createApp(config, auth).listen(config.PORT, config.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1', () => {
    console.log('QCAcesso API em http://localhost:' + config.PORT);
  });
  server.on('error', () => {
    console.error('Não foi possível iniciar a API. Verifique a porta configurada.');
    pararJobs();
    auth.close();
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      pararJobs();
      auth.close();
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 5000).unref();
    });
  }
}

iniciarServidor().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Não foi possível iniciar a API.');
  process.exitCode = 1;
});
