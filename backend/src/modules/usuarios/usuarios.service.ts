import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../config/database.types';
import type { PerfilUsuario, UsuarioAutenticado } from '../auth/auth.types';
import { AuthError } from '../auth/auth.types';

type Db = SupabaseClient<Database>;
type UsuarioRow = Database['public']['Tables']['usuarios']['Row'];

export interface UsuarioAdminItem {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  ativo: boolean;
  criadoEm: string;
}

export interface UsuariosListagem { itens: UsuarioAdminItem[]; total: number }

const erroUsuarios = () => new AuthError(503, 'USUARIOS_INDISPONIVEIS', 'Não foi possível carregar a gestão de usuários.');

function toItem(row: UsuarioRow): UsuarioAdminItem {
  return { id: row.id, nome: row.nome, email: row.email, perfil: row.perfil, ativo: row.ativo, criadoEm: row.created_at };
}

export async function listarUsuarios(db: Db, busca = '', offset = 0): Promise<UsuariosListagem> {
  let query = db.from('usuarios').select('id,nome,email,perfil,ativo,created_at', { count: 'exact' })
    .order('nome', { ascending: true }).range(offset, offset + 79);
  const termo = busca.trim().replace(/[%_,().]/g, ' ');
  if (termo) query = query.or(`nome.ilike.%${termo}%,email.ilike.%${termo}%`);
  const { data, count, error } = await query;
  if (error) throw erroUsuarios();
  return { itens: ((data ?? []) as UsuarioRow[]).map(toItem), total: count ?? 0 };
}

export async function atualizarUsuario(
  db: Db,
  atual: UsuarioAutenticado,
  id: string,
  input: { perfil: PerfilUsuario; ativo: boolean },
): Promise<UsuarioAdminItem> {
  if (atual.perfil !== 'ADMIN') throw new AuthError(403, 'PERFIL_NAO_PERMITIDO', 'Somente Administração pode alterar usuários.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new AuthError(400, 'ID_INVALIDO', 'Identificador de usuário inválido.');
  }
  if (!['ADMIN', 'RH', 'SUPERVISOR', 'AUDITOR'].includes(input.perfil) || typeof input.ativo !== 'boolean') {
    throw new AuthError(400, 'DADOS_INVALIDOS', 'Perfil ou status de usuário inválido.');
  }
  const { data, error } = await (db as any).rpc('administrar_usuario', {
    p_usuario_id: id,
    p_perfil: input.perfil,
    p_ativo: input.ativo,
  });
  if (error) tratarErroRpc(String(error.message ?? ''));
  if (!data) throw erroUsuarios();
  return toItem(data as UsuarioRow);
}

function tratarErroRpc(message: string): never {
  const erros: Record<string, [number, string, string]> = {
    USUARIO_NAO_ENCONTRADO: [404, 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.'],
    ULTIMO_ADMIN: [409, 'ULTIMO_ADMIN', 'Não é possível desativar ou rebaixar o último administrador.'],
    USUARIO_PROPRIO: [409, 'USUARIO_PROPRIO', 'Não é possível desativar ou rebaixar a própria conta.'],
    PERFIL_NAO_PERMITIDO: [403, 'PERFIL_NAO_PERMITIDO', 'Somente Administração pode alterar usuários.'],
  };
  const code = Object.keys(erros).find((key) => message.includes(key));
  if (code) throw new AuthError(...erros[code]);
  throw erroUsuarios();
}
