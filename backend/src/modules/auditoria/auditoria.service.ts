import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TipoEvento } from '../../config/database.types';
import { AuthError } from '../auth/auth.types';

type Db = SupabaseClient<Database>;

export interface AuditoriaItem {
  id: string;
  tipo: TipoEvento;
  entidade: string | null;
  entidadeId: string | null;
  descricao: string;
  dataHora: string;
  usuario: { id: string; nome: string; email: string } | null;
}
export interface AuditoriaListagem { itens: AuditoriaItem[]; total: number }

const tipos: TipoEvento[] = ['UPLOAD', 'EDICAO_CHECKLIST', 'CONFIRMACAO_BLOQUEIO', 'CONFIRMACAO_DESBLOQUEIO', 'ENVIO_ALERTA', 'CONFIGURACAO_ALTERADA'];

export async function listarAuditoria(db: Db, filtros: { tipo?: TipoEvento; busca?: string; inicio?: string; fim?: string; offset?: number } = {}): Promise<AuditoriaListagem> {
  let query = db.from('logs_atividade').select('id,usuario_id,tipo_evento,entidade_afetada,entidade_id,descricao,data_hora', { count: 'exact' })
    .order('data_hora', { ascending: false }).range(filtros.offset ?? 0, (filtros.offset ?? 0) + 79);
  if (filtros.tipo) query = query.eq('tipo_evento', filtros.tipo);
  if (filtros.inicio) query = query.gte('data_hora', `${filtros.inicio}T00:00:00.000Z`);
  if (filtros.fim) query = query.lt('data_hora', `${filtros.fim}T00:00:00.000Z`);
  if (filtros.busca) query = query.ilike('descricao', `%${filtros.busca.replace(/[%_,]/g, ' ')}%`);
  const { data, count, error } = await query;
  if (error) throw new AuthError(503, 'AUDITORIA_INDISPONIVEL', 'Não foi possível carregar a auditoria.');
  const rows = (data ?? []) as Array<{ id: string; usuario_id: string | null; tipo_evento: TipoEvento; entidade_afetada: string | null; entidade_id: string | null; descricao: string | null; data_hora: string }>;
  const ids = [...new Set(rows.flatMap((row) => row.usuario_id ? [row.usuario_id] : []))];
  const { data: usuarios, error: usuariosError } = ids.length
    ? await db.from('usuarios').select('id,nome,email').in('id', ids)
    : { data: [], error: null };
  if (usuariosError) throw new AuthError(503, 'AUDITORIA_INDISPONIVEL', 'Não foi possível carregar os responsáveis pela auditoria.');
  const porId = new Map(((usuarios ?? []) as Array<{ id: string; nome: string; email: string }>).map((item) => [item.id, item]));
  return {
    itens: rows.map((row) => ({ id: row.id, tipo: row.tipo_evento, entidade: row.entidade_afetada, entidadeId: row.entidade_id, descricao: row.descricao ?? 'Evento registrado.', dataHora: row.data_hora, usuario: row.usuario_id ? porId.get(row.usuario_id) ?? null : null })),
    total: count ?? 0,
  };
}

export function tipoAuditoriaValido(value: string): value is TipoEvento { return tipos.includes(value as TipoEvento); }
