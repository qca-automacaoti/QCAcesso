import { createApp } from './app';
import { loadEnv } from './config/env';
import { createIdentityProvider } from './modules/auth/auth.provider';
import { AuthService } from './modules/auth/auth.service';

try {
  const config = loadEnv();
  const auth = new AuthService(createIdentityProvider(config), config.SESSION_TTL_MS);
  const server = createApp(config, auth).listen(config.PORT, config.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1', () => {
    console.log('QCAcesso API em http://localhost:' + config.PORT);
  });
  server.on('error', () => { console.error('Não foi possível iniciar a API. Verifique a porta configurada.'); auth.close(); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      auth.close();
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 5000).unref();
    });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Não foi possível iniciar a API.');
  process.exitCode = 1;
}
