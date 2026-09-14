import type { EnvConfig } from '../../config/env';
import { createDatabase } from '../../config/database';
import { AuthError } from './auth.types';
import type { IdentityProvider, IdentitySession, Usuario } from './auth.types';

function authFailure(error: { status?: number; code?: string } | null, login = false): never {
  if (error?.status === 429) throw new AuthError(429, 'MUITAS_TENTATIVAS', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
  if (error && (!error.status || error.status >= 500)) {
    throw new AuthError(503, 'SERVICO_INDISPONIVEL', 'Serviço de autenticação indisponível. Tente novamente.');
  }
  throw new AuthError(401, login ? 'CREDENCIAIS_INVALIDAS' : 'SESSAO_EXPIRADA',
    login ? 'E-mail ou senha inválidos.' : 'Sua sessão expirou. Entre novamente.');
}

export function createIdentityProvider(config: EnvConfig): IdentityProvider {
  const probe = createDatabase(config);
  return {
    async health() {
      const { error } = await probe.from('usuarios').select('id', { head: true }).limit(0);
      if (error) throw new Error('Banco indisponível.');
    },
    createSession(): IdentitySession {
      const client = createDatabase(config);
      async function loadProfile(id: string): Promise<Usuario> {
        const { data, error } = await client.from('usuarios')
          .select('id,nome,email,perfil,ativo,created_at').eq('id', id).maybeSingle();
        if (error) throw new AuthError(503, 'PERFIL_INDISPONIVEL', 'Não foi possível consultar o perfil. Tente novamente.');
        if (!data) throw new AuthError(403, 'ACESSO_NEGADO', 'Usuário sem acesso ativo ao QCAcesso. Contate o administrador.');
        return data;
      }
      return {
        async signIn(email, senha) {
          const { data, error } = await client.auth.signInWithPassword({ email, password: senha });
          if (error || !data.user || !data.session) authFailure(error, true);
          return loadProfile(data.user.id);
        },
        async currentUser() {
          // getSession renova o token quando necessário. O serviço coordena chamadas concorrentes.
          const current = await client.auth.getSession();
          if (current.error || !current.data.session) authFailure(current.error);
          // Sempre validar a identidade no Auth; não autorizar pelo user de getSession.
          const { data, error } = await client.auth.getUser(current.data.session.access_token);
          if (error || !data.user) authFailure(error);
          return loadProfile(data.user.id);
        },
        async signOut() {
          const { error } = await client.auth.signOut({ scope: 'local' });
          if (error) throw error;
        },
      };
    },
  };
}
