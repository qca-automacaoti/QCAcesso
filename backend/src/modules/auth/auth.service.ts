import { createHash, randomBytes } from 'node:crypto';
import { AuthError, authorizeUser } from './auth.types';
import type { IdentityProvider, UsuarioAutenticado } from './auth.types';
import { MemorySessionStore } from './session.store';
import type { SessionStore } from './session.store';

const keyOf = (token: string) => createHash('sha256').update(token).digest('hex');

export class AuthService {
  constructor(
    private provider: IdentityProvider,
    private ttlMs: number,
    private sessions: SessionStore = new MemorySessionStore(),
    private now = Date.now,
  ) {}

  private unauthenticated(): never {
    throw new AuthError(401, 'SESSAO_EXPIRADA', 'Sua sessão expirou. Entre novamente.');
  }

  async login(email: string, senha: string) {
    if (await this.sessions.count(this.now()) >= 1000) {
      throw new AuthError(503, 'LIMITE_SESSOES', 'Sistema ocupado. Tente novamente em alguns minutos.');
    }
    const identity = this.provider.createSession();
    try {
      const usuario = authorizeUser(await identity.signIn(email, senha));
      const token = randomBytes(32).toString('base64url');
      const expiresAt = this.now() + this.ttlMs;
      await this.sessions.create(keyOf(token), identity, expiresAt, usuario.id);
      return { token, usuario, expiresAt };
    } catch (error) {
      await identity.signOut().catch(() => undefined);
      throw error;
    }
  }

  async currentUser(token: string | undefined): Promise<UsuarioAutenticado> {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return this.unauthenticated();
    const key = keyOf(token);
    const session = await this.sessions.get(key, this.now());
    if (!session) return this.unauthenticated();
    // Deduplica getSession/refresh e consulta de perfil durante requisições concorrentes.
    session.pending ??= session.identity.currentUser().then(authorizeUser).finally(() => { session.pending = undefined; });
    try {
      const usuario = await session.pending;
      if (session.expiresAt <= this.now()) return this.unauthenticated();
      return usuario;
    } catch (error) {
      if (error instanceof AuthError && [401, 403].includes(error.status)) await this.sessions.delete(key);
      throw error;
    }
  }

  async accessToken(token: string | undefined): Promise<string> {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return this.unauthenticated();
    const session = await this.sessions.get(keyOf(token), this.now());
    if (!session) return this.unauthenticated();
    return session.identity.accessToken();
  }

  async logout(token: string | undefined) {
    if (!token) return;
    const key = keyOf(token);
    const session = await this.sessions.get(key, this.now()).catch(() => undefined);
    await this.sessions.delete(key); // Revogação imediata, mesmo se o Supabase estiver indisponível.
    if (session) {
      await session.pending?.catch(() => undefined);
      await session.identity.signOut().catch(() => undefined);
    }
  }

  health() { return this.provider.health(); }
  close() { this.sessions.dispose(); }
}
