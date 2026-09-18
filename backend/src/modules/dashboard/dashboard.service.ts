import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  StatusControle,
  TipoAcao,
  TipoEvento,
} from '../../config/database.types';
import { AuthError } from '../auth/auth.types';

type Db = SupabaseClient<Database>;
type TableName = keyof Database['public']['Tables'];

export interface DashboardIndicador {
  id: string;
  titulo: string;
  valor: number;
  descricao: string;
  status: 'neutro' | 'sucesso' | 'alerta' | 'perigo';
}

export interface DashboardAcao {
  id: string;
  tipo: TipoAcao;
  status: StatusControle;
  dataProgramada: string;
  diasParaAcao: number;
  funcionario: string;
  empresa: string;
  cadastro: string;
}

export interface DashboardEvento {
  id: string;
  tipo: TipoEvento;
  descricao: string;
  dataHora: string;
}

export interface DashboardResumo {
  geradoEm: string;
  indicadores: DashboardIndicador[];
  controle: {
    bloqueiosPendentes: number;
    desbloqueiosPendentes: number;
    atrasados: number;
    confirmadosMes: number;
  };
  ferias: {
    funcionariosTotal: number;
    emFerias: number;
    bloqueados: number;
    periodosAtivos: number;
    proximos7Dias: number;
  };
  revisao: {
    pendentes: number;
    confirmados: number;
    rejeitados: number;
    uploadsComErro: number;
  };
  alertas: {
    enviadosHoje: number;
    falhas: number;
  };
  proximasAcoes: DashboardAcao[];
  atividadeRecente: DashboardEvento[];
}

interface ControleRow {
  id: string;
  periodo_ferias_id: string;
  tipo_acao: TipoAcao;
  data_programada: string;
  status: StatusControle;
}

interface PeriodoRow {
  id: string;
  funcionario_id: string;
  data_inicio: string;
  data_fim: string;
}

interface FuncionarioRow {
  id: string;
  nome: string;
  empresa: string;
  cadastro: string;
}

interface LogAtividadeRow {
  id: string;
  tipo_evento: TipoEvento;
  descricao: string | null;
  data_hora: string;
}

const erroDashboard = () =>
  new AuthError(503, 'DASHBOARD_INDISPONIVEL', 'Não foi possível carregar os indicadores do dashboard.');

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function daysBetween(start: string, end: string) {
  const startDate = Date.parse(start + 'T00:00:00.000Z');
  const endDate = Date.parse(end + 'T00:00:00.000Z');
  return Math.round((endDate - startDate) / 86_400_000);
}

async function countRows(db: Db, table: TableName, build?: (query: any) => any) {
  const base = db.from(table).select('*', { count: 'exact', head: true });
  const query = build ? build(base) : base;
  const { count, error } = await query;
  if (error) throw erroDashboard();
  return count ?? 0;
}

async function carregarProximasAcoes(db: Db, hoje: string, limite: string): Promise<DashboardAcao[]> {
  const { data, error } = await db.from('controle_acesso')
    .select('id,periodo_ferias_id,tipo_acao,data_programada,status')
    .in('status', ['PENDENTE', 'ATRASADO'])
    .gte('data_programada', hoje)
    .lte('data_programada', limite)
    .order('data_programada', { ascending: true })
    .limit(8);
  if (error) throw erroDashboard();
  const controles = (data ?? []) as ControleRow[];
  if (controles.length === 0) return [];

  const periodoIds = [...new Set(controles.map((item) => item.periodo_ferias_id))];
  const { data: periodosData, error: periodosError } = await db.from('periodos_ferias')
    .select('id,funcionario_id,data_inicio,data_fim')
    .in('id', periodoIds);
  if (periodosError) throw erroDashboard();
  const periodos = new Map(((periodosData ?? []) as PeriodoRow[]).map((periodo) => [periodo.id, periodo]));

  const funcionarioIds = [...new Set([...periodos.values()].map((periodo) => periodo.funcionario_id))];
  const { data: funcionariosData, error: funcionariosError } = await db.from('funcionarios')
    .select('id,nome,empresa,cadastro')
    .in('id', funcionarioIds);
  if (funcionariosError) throw erroDashboard();
  const funcionarios = new Map(((funcionariosData ?? []) as FuncionarioRow[]).map((funcionario) => [funcionario.id, funcionario]));

  return controles.map((controle) => {
    const periodo = periodos.get(controle.periodo_ferias_id);
    const funcionario = periodo ? funcionarios.get(periodo.funcionario_id) : undefined;
    return {
      id: controle.id,
      tipo: controle.tipo_acao,
      status: controle.status,
      dataProgramada: controle.data_programada,
      diasParaAcao: daysBetween(hoje, controle.data_programada),
      funcionario: funcionario?.nome ?? 'Funcionário não localizado',
      empresa: funcionario?.empresa ?? '-',
      cadastro: funcionario?.cadastro ?? '-',
    };
  });
}

async function carregarAtividadeRecente(db: Db): Promise<DashboardEvento[]> {
  const { data, error } = await db.from('logs_atividade')
    .select('id,tipo_evento,descricao,data_hora')
    .order('data_hora', { ascending: false })
    .limit(6);
  if (error) throw erroDashboard();
  return ((data ?? []) as unknown as LogAtividadeRow[]).map((evento) => ({
    id: evento.id,
    tipo: evento.tipo_evento,
    descricao: evento.descricao || 'Evento registrado no sistema.',
    dataHora: evento.data_hora,
  }));
}

export async function carregarDashboard(db: Db): Promise<DashboardResumo> {
  const agora = new Date();
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
  const hojeBase = new Date(`${hoje}T00:00:00.000Z`);
  const seteDias = isoDate(addDays(hojeBase, 7));
  const inicioMes = isoDate(startOfMonth(hojeBase));

  const [
    funcionariosTotal,
    emFerias,
    bloqueados,
    periodosAtivos,
    proximos7Dias,
    bloqueiosPendentes,
    desbloqueiosPendentes,
    atrasados,
    confirmadosMes,
    revisaoPendentes,
    revisaoConfirmados,
    revisaoRejeitados,
    uploadsComErro,
    alertasHoje,
    alertasFalha,
    proximasAcoes,
    atividadeRecente,
  ] = await Promise.all([
    countRows(db, 'funcionarios'),
    countRows(db, 'funcionarios', (query) => query.eq('status_atual', 'DE_FERIAS')),
    countRows(db, 'funcionarios', (query) => query.eq('status_atual', 'BLOQUEADO')),
    countRows(db, 'periodos_ferias', (query) => query.eq('status', 'CONFIRMADO').lte('data_inicio', hoje).gte('data_fim', hoje)),
    countRows(db, 'periodos_ferias', (query) => query.eq('status', 'CONFIRMADO').gte('data_inicio', hoje).lte('data_inicio', seteDias)),
    countRows(db, 'controle_acesso', (query) => query.eq('tipo_acao', 'BLOQUEIO').eq('status', 'PENDENTE').gte('data_programada', hoje)),
    countRows(db, 'controle_acesso', (query) => query.eq('tipo_acao', 'DESBLOQUEIO').eq('status', 'PENDENTE').gte('data_programada', hoje)),
    Promise.all([
      countRows(db, 'controle_acesso', (query) => query.eq('status', 'ATRASADO')),
      countRows(db, 'controle_acesso', (query) => query.eq('status', 'PENDENTE').lt('data_programada', hoje)),
    ]).then(([marcados, vencidos]) => marcados + vencidos),
    countRows(db, 'controle_acesso', (query) => query.eq('status', 'CONFIRMADO').gte('confirmado_em', inicioMes)),
    countRows(db, 'checklist_revisao', (query) => query.eq('status_revisao', 'PENDENTE')),
    countRows(db, 'checklist_revisao', (query) => query.eq('status_revisao', 'CONFIRMADO')),
    countRows(db, 'checklist_revisao', (query) => query.eq('status_revisao', 'REJEITADO')),
    countRows(db, 'upload_planilhas', (query) => query.eq('status', 'ERRO')),
    countRows(db, 'alertas', (query) => query.gte('data_envio', hoje)),
    countRows(db, 'alertas', (query) => query.eq('status_envio', 'FALHA')),
    carregarProximasAcoes(db, hoje, seteDias),
    carregarAtividadeRecente(db),
  ]);

  return {
    geradoEm: agora.toISOString(),
    indicadores: [
      {
        id: 'bloqueios',
        titulo: 'Bloqueios pendentes',
        valor: bloqueiosPendentes,
        descricao: 'Ações de bloqueio aguardando confirmação',
        status: bloqueiosPendentes > 0 ? 'alerta' : 'sucesso',
      },
      {
        id: 'desbloqueios',
        titulo: 'Desbloqueios pendentes',
        valor: desbloqueiosPendentes,
        descricao: 'Liberações previstas para retorno de férias',
        status: desbloqueiosPendentes > 0 ? 'alerta' : 'sucesso',
      },
      {
        id: 'atrasos',
        titulo: 'Ações atrasadas',
        valor: atrasados,
        descricao: 'Itens fora da data programada',
        status: atrasados > 0 ? 'perigo' : 'sucesso',
      },
      {
        id: 'ferias',
        titulo: 'Em férias agora',
        valor: periodosAtivos || emFerias,
        descricao: 'Períodos confirmados em andamento',
        status: 'neutro',
      },
    ],
    controle: { bloqueiosPendentes, desbloqueiosPendentes, atrasados, confirmadosMes },
    ferias: { funcionariosTotal, emFerias, bloqueados, periodosAtivos, proximos7Dias },
    revisao: { pendentes: revisaoPendentes, confirmados: revisaoConfirmados, rejeitados: revisaoRejeitados, uploadsComErro },
    alertas: { enviadosHoje: alertasHoje, falhas: alertasFalha },
    proximasAcoes,
    atividadeRecente,
  };
}
