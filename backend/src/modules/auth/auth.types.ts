// Fonte: schema.sql, public.usuarios e enum perfil_usuario. Sem modelos de fases futuras.
export const PERFIS = ['ADMIN', 'RH', 'SUPERVISOR', 'AUDITOR'] as const;
export type PerfilUsuario = (typeof PERFIS)[number];

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  ativo: boolean;
  created_at: string;
}

export type UsuarioAutenticado = Pick<Usuario, 'id' | 'nome' | 'email' | 'perfil'>;

export function authorizeUser(user: Usuario | null): UsuarioAutenticado {
  if (!user || user.ativo !== true || !PERFIS.includes(user.perfil)) {
    throw new AuthError(403, 'ACESSO_NEGADO', 'Usuário sem acesso ativo ao QCAcesso. Contate o administrador.');
  }
  return { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil };
}

export class AuthError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

// Tokens do Supabase Auth. Persistidos para reconstruir a sessão em ambiente serverless,
// onde o cliente que guardava a identidade em memória não sobrevive entre requisições.
export interface IdentityTokens {
  accessToken: string;
  refreshToken: string;
}

export interface IdentitySession {
  signIn(email: string, senha: string): Promise<Usuario>;
  currentUser(): Promise<Usuario>;
  accessToken(): Promise<string>;
  signOut(): Promise<void>;
  /** Ausente em provedores que não expõem tokens (usado apenas pelo store persistente). */
  tokens?(): Promise<IdentityTokens>;
}
export interface IdentityProvider {
  createSession(): IdentitySession;
  /** Reconstrói uma sessão a partir dos tokens persistidos. */
  restoreSession?(tokens: IdentityTokens): IdentitySession;
  health(): Promise<void>;
}
