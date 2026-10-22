/**
 * Armazenamento de sessões.
 *
 * Em processo persistente (dev e hosts tradicionais) a sessão vive em memória, como antes.
 * Em ambiente serverless a memória não sobrevive entre requisições, então os tokens do
 * Supabase são gravados no banco e a identidade é reconstruída a cada chamada.
 */
import type { EnvConfig } from '../../config/env';
import { createAdminDatabase } from '../../config/database';
import type { IdentityProvider, IdentitySession, UsuarioAutenticado } from './auth.types';

export interface StoredSession {
  identity: IdentitySession;
  expiresAt: number;
  /** Deduplica consultas concorrentes de perfil dentro da mesma instância. */
  pending?: Promise<UsuarioAutenticado>;
}

export interface SessionStore {
  create(key: string, identity: IdentitySession, expiresAt: number, usuarioId: string): Promise<void>;
  get(key: string, now: number): Promise<StoredSession | undefined>;
  delete(key: string): Promise<void>;
  count(now: number): Promise<number>;
  dispose(): void;
}

export class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, StoredSession>();
  private timer: ReturnType<typeof setInterval>;
  constructor(private now = Date.now) {
    this.timer = setInterval(() => this.prune(), 60_000);
    this.timer.unref();
  }
  private prune() {
    for (const [key, session] of this.sessions) {
      if (session.expiresAt <= this.now()) this.sessions.delete(key);
    }
  }
  async create(key: string, identity: IdentitySession, expiresAt: number) {
    this.sessions.set(key, { identity, expiresAt });
  }
  async get(key: string, now: number) {
    const session = this.sessions.get(key);
    if (!session) return undefined;
    if (session.expiresAt <= now) {
      this.sessions.delete(key);
      return undefined;
    }
    return session;
  }
  async delete(key: string) {
    this.sessions.delete(key);
  }
  async count(now: number) {
    this.prune();
    void now;
    return this.sessions.size;
  }
  dispose() {
    clearInterval(this.timer);
    this.sessions.clear();
  }
}

export class SupabaseSessionStore implements SessionStore {
  private db: ReturnType<typeof createAdminDatabase>;
  constructor(config: EnvConfig, private provider: IdentityProvider) {
    if (!provider.restoreSession) throw new Error('O provedor de identidade não suporta sessões persistidas.');
    this.db = createAdminDatabase(config);
  }

  async create(key: string, identity: IdentitySession, expiresAt: number, usuarioId: string) {
    const tokens = await identity.tokens!();
    const { error } = await (this.db.from('sessoes') as any).insert({
      token_hash: key,
      usuario_id: usuarioId,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: new Date(expiresAt).toISOString(),
    });
    if (error) throw new Error('Não foi possível registrar a sessão.');
  }

  async get(key: string, now: number) {
    const { data, error } = await (this.db.from('sessoes') as any)
      .select('access_token,refresh_token,expires_at').eq('token_hash', key).maybeSingle();
    if (error) throw new Error('Não foi possível consultar a sessão.');
    if (!data) return undefined;
    const expiresAt = Date.parse(data.expires_at);
    if (expiresAt <= now) {
      await this.delete(key);
      return undefined;
    }
    const identity = this.provider.restoreSession!({ accessToken: data.access_token, refreshToken: data.refresh_token });
    // O Supabase rotaciona o refresh_token ao renovar: grava os novos valores após cada uso.
    const persistir = async () => {
      try {
        const atual = await identity.tokens!();
        if (atual.accessToken === data.access_token && atual.refreshToken === data.refresh_token) return;
        await (this.db.from('sessoes') as any)
          .update({ access_token: atual.accessToken, refresh_token: atual.refreshToken }).eq('token_hash', key);
      } catch { /* a renovação é oportunista; a requisição atual já foi atendida */ }
    };
    return {
      expiresAt,
      identity: {
        signIn: identity.signIn,
        tokens: identity.tokens,
        signOut: identity.signOut,
        currentUser: async () => { const usuario = await identity.currentUser(); await persistir(); return usuario; },
        accessToken: async () => { const token = await identity.accessToken(); await persistir(); return token; },
      },
    };
  }

  async delete(key: string) {
    await (this.db.from('sessoes') as any).delete().eq('token_hash', key);
  }

  async count(now: number) {
    await (this.db.from('sessoes') as any).delete().lt('expires_at', new Date(now).toISOString());
    const { count, error } = await (this.db.from('sessoes') as any).select('token_hash', { count: 'exact', head: true });
    if (error) throw new Error('Não foi possível consultar as sessões ativas.');
    return count ?? 0;
  }

  dispose() { /* sem recursos locais: a limpeza acontece no banco */ }
}
