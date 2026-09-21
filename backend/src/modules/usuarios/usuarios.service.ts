import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../config/database.types';
import type { PerfilUsuario, UsuarioAutenticado } from '../auth/auth.types';
import { AuthError } from '../auth/auth.types';
import { createAdminDatabase } from '../../config/database';
import type { EnvConfig } from '../../config/env';

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
export interface NovoUsuarioInput { nome: string; email: string; senha: string; perfil: PerfilUsuario }

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

export async function criarUsuario(config: EnvConfig, atual: UsuarioAutenticado, input: NovoUsuarioInput): Promise<UsuarioAdminItem> {
  if (atual.perfil !== 'ADMIN') throw new AuthError(403, 'PERFIL_NAO_PERMITIDO', 'Somente Administração pode cadastrar usuários.');
  const nome = input.nome.trim();
  const email = input.email.trim().toLowerCase();
  if (nome.length < 2 || nome.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || input.senha.length < 8 || input.senha.length > 128 || !['ADMIN', 'RH', 'SUPERVISOR', 'AUDITOR'].includes(input.perfil)) {
    throw new AuthError(400, 'DADOS_INVALIDOS', 'Informe nome, e-mail, senha de no mínimo 8 caracteres e perfil válido.');
  }
  if (!config.SUPABASE_SERVICE_ROLE_KEY) throw new AuthError(503, 'CADASTRO_INDISPONIVEL', 'Configure a credencial administrativa do Supabase para cadastrar usuários.');
  const admin = createAdminDatabase(config);
  const { data, error } = await admin.auth.admin.createUser({ email, password: input.senha, email_confirm: true, user_metadata: { nome } });
  if (error || !data.user) {
    if (error?.message.toLowerCase().includes('already') || error?.message.toLowerCase().includes('registered')) throw new AuthError(409, 'EMAIL_JA_CADASTRADO', 'Já existe um usuário com este e-mail.');
    throw new AuthError(503, 'CADASTRO_INDISPONIVEL', 'Não foi possível cadastrar o usuário.');
  }
  const id = data.user.id;
  const { data: perfil, error: perfilError } = await (admin as any).from('usuarios').upsert({ id, nome, email, perfil: input.perfil, ativo: true }, { onConflict: 'id' }).select('id,nome,email,perfil,ativo,created_at').single();
  if (perfilError || !perfil) {
    await admin.auth.admin.deleteUser(id).catch(() => undefined);
    throw new AuthError(503, 'CADASTRO_INDISPONIVEL', 'Usuário criado na autenticação, mas não foi possível concluir o perfil.');
  }
  await (admin as any).from('logs_atividade').insert({ usuario_id: atual.id, tipo_evento: 'CONFIGURACAO_ALTERADA', entidade_afetada: 'usuarios', entidade_id: id, descricao: `Usuário ${email} cadastrado com perfil ${input.perfil}.` });
  return toItem(perfil as UsuarioRow);
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
