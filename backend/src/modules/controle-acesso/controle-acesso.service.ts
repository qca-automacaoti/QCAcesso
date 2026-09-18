import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, StatusControle, TipoAcao } from '../../config/database.types';
import type { UsuarioAutenticado } from '../auth/auth.types';
import { AuthError } from '../auth/auth.types';

type Db = SupabaseClient<Database>;
type ControleRow = Database['public']['Tables']['controle_acesso']['Row'];

export interface ControleAcessoItem {
  id: string;
  tipo: TipoAcao;
  status: StatusControle;
  dataProgramada: string;
  confirmadoEm: string | null;
  periodoInicio: string;
  periodoFim: string;
  funcionario: { id: string; nome: string; empresa: string; cadastro: string };
  supervisorNome: string | null;
}

export interface ControleAcessoResumo {
  pendentes: number;
  atrasados: number;
  confirmados: number;
  cancelados: number;
}

export interface ControleAcessoListagem {
  itens: ControleAcessoItem[];
  total: number;
  resumo: ControleAcessoResumo;
}

const erroControle = () => new AuthError(503, 'CONTROLE_INDISPONIVEL', 'Não foi possível carregar o controle de acesso. Tente novamente.');

function dataLocal() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function normalizarStatus(row: ControleRow, hoje: string): StatusControle {
  return row.status === 'PENDENTE' && row.data_programada < hoje ? 'ATRASADO' : row.status;
}

export async function listarControleAcesso(
  db: Db,
  usuario: UsuarioAutenticado,
  filtros: { status?: StatusControle; tipo?: TipoAcao; offset?: number } = {},
): Promise<ControleAcessoListagem> {
  const hoje = dataLocal();
  const offset = filtros.offset ?? 0;

  const criarQuery = (count = false) => {
    let query = db.from('controle_acesso').select(
      'id,periodo_ferias_id,tipo_acao,data_programada,status,supervisor_id,confirmado_em,created_at,updated_at',
      count ? { count: 'exact', head: true } : { count: 'exact' },
    );
    if (usuario.perfil === 'SUPERVISOR') query = query.eq('supervisor_id', usuario.id);
    if (filtros.tipo) query = query.eq('tipo_acao', filtros.tipo);
    if (filtros.status === 'ATRASADO') {
      query = query.in('status', ['PENDENTE', 'ATRASADO']).lt('data_programada', hoje);
    } else if (filtros.status === 'PENDENTE') {
      query = query.eq('status', 'PENDENTE').gte('data_programada', hoje);
    } else if (filtros.status) {
      query = query.eq('status', filtros.status);
    }
    return query;
  };

  let listQuery = criarQuery().order('data_programada', { ascending: true }).order('created_at', { ascending: true }).range(offset, offset + 79);
  const [{ data, error, count }, resumo] = await Promise.all([
    listQuery,
    carregarResumo(db, usuario, hoje),
  ]);
  if (error) throw erroControle();
  const controles = (data ?? []) as unknown as ControleRow[];
  if (controles.length === 0) return { itens: [], total: count ?? 0, resumo };

  const periodoIds = [...new Set(controles.map((item) => item.periodo_ferias_id))];
  const { data: periodosData, error: periodosError } = await db.from('periodos_ferias')
    .select('id,funcionario_id,data_inicio,data_fim')
    .in('id', periodoIds);
  if (periodosError) throw erroControle();
  const periodos = (periodosData ?? []) as Array<{ id: string; funcionario_id: string; data_inicio: string; data_fim: string }>;
  const periodoPorId = new Map(periodos.map((periodo) => [periodo.id, periodo]));
  const funcionarioIds = [...new Set(periodos.map((periodo) => periodo.funcionario_id))];
  const { data: funcionariosData, error: funcionariosError } = funcionarioIds.length
    ? await db.from('funcionarios').select('id,nome,empresa,cadastro').in('id', funcionarioIds)
    : { data: [], error: null };
  if (funcionariosError) throw erroControle();
  const funcionarios = (funcionariosData ?? []) as Array<{ id: string; nome: string; empresa: string; cadastro: string }>;
  const funcionarioPorId = new Map(funcionarios.map((funcionario) => [funcionario.id, funcionario]));

  const supervisorIds = [...new Set(controles.flatMap((item) => item.supervisor_id ? [item.supervisor_id] : []))];
  const { data: supervisoresData, error: supervisoresError } = supervisorIds.length
    ? await db.from('usuarios').select('id,nome').in('id', supervisorIds)
    : { data: [], error: null };
  if (supervisoresError) throw erroControle();
  const supervisores = new Map(((supervisoresData ?? []) as Array<{ id: string; nome: string }>).map((item) => [item.id, item.nome]));

  return {
    itens: controles.flatMap((controle) => {
      const periodo = periodoPorId.get(controle.periodo_ferias_id);
      const funcionario = periodo ? funcionarioPorId.get(periodo.funcionario_id) : undefined;
      if (!periodo || !funcionario) return [];
      return [{
        id: controle.id,
        tipo: controle.tipo_acao,
        status: normalizarStatus(controle, hoje),
        dataProgramada: controle.data_programada,
        confirmadoEm: controle.confirmado_em,
        periodoInicio: periodo.data_inicio,
        periodoFim: periodo.data_fim,
        funcionario,
        supervisorNome: controle.supervisor_id ? supervisores.get(controle.supervisor_id) ?? null : null,
      }];
    }),
    total: count ?? 0,
    resumo,
  };
}

async function carregarResumo(db: Db, usuario: UsuarioAutenticado, hoje: string): Promise<ControleAcessoResumo> {
  async function count(status: StatusControle, atrasado?: boolean) {
    let query = db.from('controle_acesso').select('*', { count: 'exact', head: true }).eq('status', status);
    if (usuario.perfil === 'SUPERVISOR') query = query.eq('supervisor_id', usuario.id);
    if (atrasado) query = query.lt('data_programada', hoje);
    if (status === 'PENDENTE') query = atrasado ? query.lt('data_programada', hoje) : query.gte('data_programada', hoje);
    const { count: total, error } = await query;
    if (error) throw erroControle();
    return total ?? 0;
  }
  const [pendentes, pendentesAtrasados, atrasadosMarcados, confirmados, cancelados] = await Promise.all([
    count('PENDENTE'),
    count('PENDENTE', true),
    count('ATRASADO'),
    count('CONFIRMADO'),
    count('CANCELADO'),
  ]);
  return { pendentes, atrasados: pendentesAtrasados + atrasadosMarcados, confirmados, cancelados };
}

export async function confirmarControleAcesso(db: Db, id: string): Promise<ControleRow> {
  const { data, error } = await (db as any).rpc('confirmar_controle_acesso', { p_controle_id: id });
  if (error) tratarErroRpc(String(error.message ?? ''));
  if (!data) throw erroControle();
  return data as ControleRow;
}

function tratarErroRpc(mensagem: string): never {
  const erros: Record<string, [number, string, string]> = {
    NAO_AUTENTICADO: [401, 'NAO_AUTENTICADO', 'Entre na sua conta para continuar.'],
    PERFIL_NAO_PERMITIDO: [403, 'PERFIL_NAO_PERMITIDO', 'Seu perfil não pode confirmar ações de acesso.'],
    ACAO_NAO_ENCONTRADA: [404, 'ACAO_NAO_ENCONTRADA', 'Ação de controle de acesso não encontrada.'],
    ACAO_JA_CONCLUIDA: [409, 'ACAO_JA_CONCLUIDA', 'Esta ação já foi concluída ou cancelada.'],
    ACAO_DE_OUTRO_SUPERVISOR: [403, 'ACAO_DE_OUTRO_SUPERVISOR', 'Somente o supervisor responsável pode confirmar esta ação.'],
    ACAO_ANTES_DA_DATA: [409, 'ACAO_ANTES_DA_DATA', 'A ação só pode ser confirmada a partir da data programada.'],
    PERIODO_INDISPONIVEL: [409, 'PERIODO_INDISPONIVEL', 'O período de férias não está mais ativo.'],
  };
  const chave = Object.keys(erros).find((codigo) => mensagem.includes(codigo));
  const erro = chave ? erros[chave] : undefined;
  if (erro) throw new AuthError(...erro);
  throw erroControle();
}
