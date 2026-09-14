import { createHash, randomBytes } from 'node:crypto';
import { AuthError, authorizeUser } from './auth.types';
import type { IdentityProvider, IdentitySession, UsuarioAutenticado } from './auth.types';

interface StoredSession {
  identity: IdentitySession;
  expiresAt: number;
  pending?: Promise<UsuarioAutenticado>;
}
const keyOf = (token: string) => createHash('sha256').update(token).digest('hex');

export class AuthService {
  private sessions = new Map<string, StoredSession>();
  private cleanup: ReturnType<typeof setInterval>;
  constructor(private provider: IdentityProvider, private ttlMs: number, private now = Date.now) {
    this.cleanup = setInterval(() => this.prune(), 60_000);
    this.cleanup.unref();
  }
  private prune() {
    for (const [key, session] of this.sessions) {
      if (session.expiresAt <= this.now()) this.sessions.delete(key);
    }
  }
  private unauthenticated(): never {
    throw new AuthError(401, 'SESSAO_EXPIRADA', 'Sua sessão expirou. Entre novamente.');
  }
  async login(email: string, senha: string) {
    this.prune();
    if (this.sessions.size >= 1000) throw new AuthError(503, 'LIMITE_SESSOES', 'Sistema ocupado. Tente novamente em alguns minutos.');
    const identity = this.provider.createSession();
    try {
      const usuario = authorizeUser(await identity.signIn(email, senha));
      const token = randomBytes(32).toString('base64url');
      const expiresAt = this.now() + this.ttlMs;
      this.sessions.set(keyOf(token), { identity, expiresAt });
      return { token, usuario, expiresAt };
    } catch (error) {
      await identity.signOut().catch(() => undefined);
      throw error;
    }
  }
  async currentUser(token: string | undefined): Promise<UsuarioAutenticado> {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return this.unauthenticated();
    const key = keyOf(token);
    const session = this.sessions.get(key);
    if (!session || session.expiresAt <= this.now()) {
      this.sessions.delete(key);
      return this.unauthenticated();
    }
    // Deduplica getSession/refresh e consulta de perfil durante requisições concorrentes.
    session.pending ??= session.identity.currentUser().then(authorizeUser).finally(() => { session.pending = undefined; });
    try {
      const usuario = await session.pending;
      if (this.sessions.get(key) !== session || session.expiresAt <= this.now()) return this.unauthenticated();
      return usuario;
    } catch (error) {
      if (error instanceof AuthError && [401, 403].includes(error.status)) this.sessions.delete(key);
      throw error;
    }
  }
  async logout(token: string | undefined) {
    if (!token) return;
    const key = keyOf(token);
    const session = this.sessions.get(key);
    this.sessions.delete(key); // Revogação imediata, mesmo se o Supabase estiver indisponível.
    if (session) {
      await session.pending?.catch(() => undefined);
      await session.identity.signOut().catch(() => undefined);
    }
  }
  health() { return this.provider.health(); }
  close() {
    clearInterval(this.cleanup);
    this.sessions.clear();
  }
}
