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

export interface IdentitySession {
  signIn(email: string, senha: string): Promise<Usuario>;
  currentUser(): Promise<Usuario>;
  signOut(): Promise<void>;
}
export interface IdentityProvider {
  createSession(): IdentitySession;
  health(): Promise<void>;
}
