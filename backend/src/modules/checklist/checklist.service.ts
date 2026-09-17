import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, StatusRevisao } from '../../config/database.types';
import { AuthError } from '../auth/auth.types';

type Db = SupabaseClient<Database>;
type ChecklistRow = Database['public']['Tables']['checklist_revisao']['Row'];

export interface ChecklistItem {
  id: string;
  uploadId: string;
  funcionarioId: string | null;
  empresa: string;
  cadastro: string;
  nome: string;
  dataInicio: string;
  dataFim: string;
  status: StatusRevisao;
  supervisorId: string | null;
  supervisorNome: string | null;
  supervisorAtivo: boolean;
  revisadoPor: string | null;
  revisadoEm: string | null;
  criadoEm: string;
}

export interface ChecklistResumo {
  pendentes: number;
  editados: number;
  confirmados: number;
  rejeitados: number;
}

export interface ChecklistListagem {
  itens: ChecklistItem[];
  total: number;
  resumo: ChecklistResumo;
  supervisores: ChecklistSupervisor[];
}

export interface ChecklistSupervisor {
  id: string;
  nome: string;
}

export interface EditarChecklistInput {
  empresa: string;
  cadastro: string;
  nome: string;
  dataInicio: string;
  dataFim: string;
  supervisorId: string;
}

function erroChecklist(): never {
  throw new AuthError(503, 'CHECKLIST_INDISPONIVEL', 'Não foi possível processar o checklist. Tente novamente.');
}

function toItem(row: ChecklistRow, supervisorId: string | null = null, supervisorNome: string | null = null, supervisorAtivo = false): ChecklistItem {
  return {
    id: row.id,
    uploadId: row.upload_id,
    funcionarioId: row.funcionario_id,
    empresa: row.empresa,
    cadastro: row.cadastro,
    nome: row.nome,
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    status: row.status_revisao,
    supervisorId,
    supervisorNome,
    supervisorAtivo,
    revisadoPor: row.revisado_por,
    revisadoEm: row.revisado_em,
    criadoEm: row.created_at,
  };
}

function validarData(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validarEdicao(input: EditarChecklistInput): EditarChecklistInput {
  const normalized = {
    empresa: String(input.empresa ?? '').trim(),
    cadastro: String(input.cadastro ?? '').trim(),
    nome: String(input.nome ?? '').trim(),
    dataInicio: String(input.dataInicio ?? '').trim(),
    dataFim: String(input.dataFim ?? '').trim(),
    supervisorId: String(input.supervisorId ?? '').trim(),
  };
  if (!normalized.empresa || !normalized.cadastro || !normalized.nome) {
    throw new AuthError(400, 'DADOS_INVALIDOS', 'Informe empresa, cadastro e nome.');
  }
  if (normalized.supervisorId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized.supervisorId)) {
    throw new AuthError(400, 'SUPERVISOR_INVALIDO', 'Selecione um supervisor ativo.');
  }
  if (!validarData(normalized.dataInicio) || !validarData(normalized.dataFim)) {
    throw new AuthError(400, 'DATAS_INVALIDAS', 'Informe datas válidas no formato AAAA-MM-DD.');
  }
  if (normalized.dataFim < normalized.dataInicio) {
    throw new AuthError(400, 'DATAS_INVALIDAS', 'A data final não pode ser anterior à data inicial.');
  }
  return normalized;
}

async function carregarResumo(db: Db): Promise<ChecklistResumo> {
  async function count(status: StatusRevisao) {
    const { count, error } = await db.from('checklist_revisao').select('*', { count: 'exact', head: true }).eq('status_revisao', status);
    if (error) erroChecklist();
    return count ?? 0;
  }
  const [pendentes, editados, confirmados, rejeitados] = await Promise.all([
    count('PENDENTE'),
    count('EDITADO'),
    count('CONFIRMADO'),
    count('REJEITADO'),
  ]);
  return { pendentes, editados, confirmados, rejeitados };
}

export async function listarChecklist(db: Db, status?: StatusRevisao, offset = 0): Promise<ChecklistListagem> {
  let query = db.from('checklist_revisao')
    .select('id,upload_id,funcionario_id,empresa,cadastro,nome,data_inicio,data_fim,status_revisao,revisado_por,revisado_em,created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + 79);
  if (status) query = query.eq('status_revisao', status);
  const { data, error, count } = await query;
  if (error) erroChecklist();
  const rows = (data ?? []) as ChecklistRow[];
  const funcionarioIds = [...new Set(rows.flatMap((row) => row.funcionario_id ? [row.funcionario_id] : []))];
  const [funcionariosResult, supervisoresResult, resumo] = await Promise.all([
    funcionarioIds.length
      ? db.from('funcionarios').select('id,supervisor_id').in('id', funcionarioIds)
      : Promise.resolve({ data: [], error: null }),
    db.from('usuarios').select('id,nome').eq('perfil', 'SUPERVISOR').eq('ativo', true).order('nome').limit(500),
    carregarResumo(db),
  ]);
  if (funcionariosResult.error || supervisoresResult.error) erroChecklist();
  const funcionarios = (funcionariosResult.data ?? []) as Array<{ id: string; supervisor_id: string | null }>;
  const supervisores = (supervisoresResult.data ?? []) as ChecklistSupervisor[];
  const supervisorIds = [...new Set(funcionarios.flatMap((funcionario) => funcionario.supervisor_id ? [funcionario.supervisor_id] : []))];
  const associadosResult = supervisorIds.length
    ? await db.from('usuarios').select('id,nome,perfil,ativo').in('id', supervisorIds)
    : { data: [], error: null };
  if (associadosResult.error) erroChecklist();
  const associados = (associadosResult.data ?? []) as Array<{ id: string; nome: string; perfil: string; ativo: boolean }>;
  const funcionarioPorId = new Map(funcionarios.map((funcionario) => [funcionario.id, funcionario]));
  const supervisorPorId = new Map(associados.map((supervisor) => [supervisor.id, supervisor]));
  return {
    itens: rows.map((row) => {
      const supervisorId = row.funcionario_id ? funcionarioPorId.get(row.funcionario_id)?.supervisor_id ?? null : null;
      const supervisor = supervisorId ? supervisorPorId.get(supervisorId) : undefined;
      const supervisorAtivo = Boolean(supervisor?.ativo && supervisor.perfil === 'SUPERVISOR');
      return toItem(row, supervisorId, supervisor?.nome ?? null, supervisorAtivo);
    }),
    total: count ?? 0,
    resumo,
    supervisores,
  };
}

export async function editarChecklist(db: Db, id: string, input: EditarChecklistInput): Promise<ChecklistItem> {
  const payload = validarEdicao(input);
  const { data, error } = await (db as any).rpc('editar_checklist_revisao', {
    p_checklist_id: id,
    p_empresa: payload.empresa,
    p_cadastro: payload.cadastro,
    p_nome: payload.nome,
    p_data_inicio: payload.dataInicio,
    p_data_fim: payload.dataFim,
    p_supervisor_id: payload.supervisorId || null,
  });
  if (error) tratarErroRpc(error.message);
  if (!data) erroChecklist();
  return toItem(data as ChecklistRow, payload.supervisorId || null, null, Boolean(payload.supervisorId));
}

export async function rejeitarChecklist(db: Db, id: string): Promise<ChecklistItem> {
  const { data, error } = await (db as any).rpc('rejeitar_checklist_revisao', { p_checklist_id: id });
  if (error) tratarErroRpc(error.message);
  if (!data) erroChecklist();
  return toItem(data as ChecklistRow);
}

export async function confirmarChecklist(db: Db, id: string): Promise<ChecklistItem> {
  const { data, error } = await (db as any).rpc('confirmar_checklist_revisao', { p_checklist_id: id });
  if (error) tratarErroRpc(error.message);
  if (!data) erroChecklist();
  return toItem(data as ChecklistRow);
}

function tratarErroRpc(mensagem: string): never {
  const erros: Record<string, [number, string, string]> = {
    NAO_AUTENTICADO: [401, 'NAO_AUTENTICADO', 'Entre na sua conta para continuar.'],
    PERFIL_NAO_PERMITIDO: [403, 'PERFIL_NAO_PERMITIDO', 'Seu perfil não pode revisar itens do checklist.'],
    DADOS_INVALIDOS: [400, 'DADOS_INVALIDOS', 'Informe empresa, cadastro e nome.'],
    DATAS_INVALIDAS: [400, 'DATAS_INVALIDAS', 'A data final não pode ser anterior à data inicial.'],
    SUPERVISOR_AUSENTE: [409, 'SUPERVISOR_AUSENTE', 'Associe um supervisor ativo antes de confirmar o período.'],
    SUPERVISOR_INVALIDO: [400, 'SUPERVISOR_INVALIDO', 'Selecione um supervisor ativo.'],
    SUPERVISOR_INATIVO: [409, 'SUPERVISOR_INATIVO', 'O supervisor associado não está ativo. Edite o item e selecione outro supervisor.'],
    CHECKLIST_NAO_ENCONTRADO: [404, 'CHECKLIST_NAO_ENCONTRADO', 'Item de checklist não encontrado.'],
    CHECKLIST_CONFIRMADO: [409, 'CHECKLIST_CONFIRMADO', 'Itens confirmados não podem ser alterados.'],
    CHECKLIST_REJEITADO: [409, 'CHECKLIST_REJEITADO', 'Itens rejeitados não podem ser confirmados ou editados.'],
    FUNCIONARIO_AUSENTE: [409, 'FUNCIONARIO_AUSENTE', 'O item não possui funcionário vinculado.'],
    PERIODO_CONFLITANTE: [409, 'PERIODO_CONFLITANTE', 'Já existe um período confirmado para este funcionário nessa faixa de datas.'],
    PERIODO_INDISPONIVEL: [409, 'PERIODO_INDISPONIVEL', 'O período já foi encerrado ou cancelado e não pode ser confirmado novamente.'],
  };
  const chave = Object.keys(erros).find((codigo) => mensagem.includes(codigo));
  const erro = chave ? erros[chave] : undefined;
  if (erro) throw new AuthError(...erro);
  erroChecklist();
}
