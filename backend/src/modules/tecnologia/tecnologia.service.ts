/**
 * Serviço de Férias da Tecnologia (tecnologia.service.ts)
 * Descrição: Monta o calendário mensal de férias da equipe de TI e aplica as regras de
 * cadastro e cancelamento. Os colaboradores de TI são os usuários com perfil TECNOLOGIA;
 * cada um possui um registro espelho em funcionarios (ligado por usuario_id) para
 * reaproveitar o fluxo de bloqueio e desbloqueio de acesso.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, StatusPeriodo } from '../../config/database.types';
import { AuthError } from '../auth/auth.types';

type Db = SupabaseClient<Database>;
type PeriodoRow = Database['public']['Tables']['periodos_ferias']['Row'];

export interface ColaboradorTi { id: string; nome: string; email: string }
export interface SupervisorTi { id: string; nome: string }

export interface PeriodoFeriasTi {
  id: string;
  colaboradorId: string | null;
  colaboradorNome: string;
  dataInicio: string;
  dataFim: string;
  status: StatusPeriodo;
  supervisorNome: string | null;
}

export interface CalendarioTi {
  mes: string;
  inicio: string;
  fim: string;
  colaboradores: ColaboradorTi[];
  supervisores: SupervisorTi[];
  periodos: PeriodoFeriasTi[];
}

export interface NovoPeriodoTiInput { colaboradorId: string; dataInicio: string; dataFim: string; supervisorId: string }

const MES_PADRAO = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATA_PADRAO = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PADRAO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const erroTecnologia = () => new AuthError(503, 'TECNOLOGIA_INDISPONIVEL', 'Não foi possível carregar o calendário da TI. Tente novamente.');

/** Mês corrente no fuso de operação (America/Sao_Paulo), no formato YYYY-MM. */
export function mesAtual(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()).slice(0, 7);
}

export function mesValido(value: string): boolean {
  return MES_PADRAO.test(value);
}

/** Primeiro e último dia do mês, em ISO, sem depender do fuso do servidor. */
export function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [ano, numero] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(ano, numero, 0)).getUTCDate();
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimo).padStart(2, '0')}` };
}

function validarData(value: string): boolean {
  if (!DATA_PADRAO.test(value)) return false;
  const data = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === value;
}

export async function montarCalendarioTi(db: Db, mes: string, incluirSupervisores: boolean): Promise<CalendarioTi> {
  const { inicio, fim } = limitesDoMes(mes);

  const [colaboradoresResultado, espelhosResultado, supervisoresResultado] = await Promise.all([
    db.from('usuarios').select('id,nome,email').eq('perfil', 'TECNOLOGIA').eq('ativo', true).order('nome', { ascending: true }),
    db.from('funcionarios').select('id,nome,usuario_id,supervisor_id').not('usuario_id', 'is', null),
    incluirSupervisores
      ? db.from('usuarios').select('id,nome').eq('perfil', 'SUPERVISOR').eq('ativo', true).order('nome', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (colaboradoresResultado.error || espelhosResultado.error || supervisoresResultado.error) throw erroTecnologia();

  const colaboradores = (colaboradoresResultado.data ?? []) as ColaboradorTi[];
  const espelhos = (espelhosResultado.data ?? []) as Array<{ id: string; nome: string; usuario_id: string | null; supervisor_id: string | null }>;
  const supervisores = (supervisoresResultado.data ?? []) as SupervisorTi[];

  if (espelhos.length === 0) {
    return { mes, inicio, fim, colaboradores, supervisores, periodos: [] };
  }

  // Períodos que tocam o mês exibido: começam antes do fim e terminam depois do início.
  const { data: periodosData, error: periodosError } = await db.from('periodos_ferias')
    .select('id,funcionario_id,data_inicio,data_fim,status,checklist_origem_id,created_at,updated_at')
    .in('funcionario_id', espelhos.map((espelho) => espelho.id))
    .neq('status', 'CANCELADO')
    .lte('data_inicio', fim)
    .gte('data_fim', inicio)
    .order('data_inicio', { ascending: true });
  if (periodosError) throw erroTecnologia();
  const periodos = (periodosData ?? []) as PeriodoRow[];

  const espelhoPorId = new Map(espelhos.map((espelho) => [espelho.id, espelho]));
  const nomesSupervisores = new Map(supervisores.map((supervisor) => [supervisor.id, supervisor.nome]));
  const supervisoresFaltantes = [...new Set(periodos.flatMap((periodo) => {
    const supervisorId = espelhoPorId.get(periodo.funcionario_id)?.supervisor_id;
    return supervisorId && !nomesSupervisores.has(supervisorId) ? [supervisorId] : [];
  }))];
  if (supervisoresFaltantes.length) {
    const { data, error } = await db.from('usuarios').select('id,nome').in('id', supervisoresFaltantes);
    if (error) throw erroTecnologia();
    for (const item of (data ?? []) as SupervisorTi[]) nomesSupervisores.set(item.id, item.nome);
  }

  return {
    mes,
    inicio,
    fim,
    colaboradores,
    supervisores,
    periodos: periodos.flatMap((periodo) => {
      const espelho = espelhoPorId.get(periodo.funcionario_id);
      if (!espelho) return [];
      return [{
        id: periodo.id,
        colaboradorId: espelho.usuario_id,
        colaboradorNome: espelho.nome,
        dataInicio: periodo.data_inicio,
        dataFim: periodo.data_fim,
        status: periodo.status,
        supervisorNome: espelho.supervisor_id ? nomesSupervisores.get(espelho.supervisor_id) ?? null : null,
      }];
    }),
  };
}

export async function registrarFeriasTi(db: Db, input: NovoPeriodoTiInput): Promise<PeriodoFeriasTi> {
  const colaboradorId = String(input.colaboradorId ?? '').trim();
  const supervisorId = String(input.supervisorId ?? '').trim();
  const dataInicio = String(input.dataInicio ?? '').trim();
  const dataFim = String(input.dataFim ?? '').trim();
  if (!UUID_PADRAO.test(colaboradorId) || !UUID_PADRAO.test(supervisorId)) {
    throw new AuthError(400, 'DADOS_INVALIDOS', 'Selecione o colaborador de TI e o supervisor responsável.');
  }
  if (!validarData(dataInicio) || !validarData(dataFim)) {
    throw new AuthError(400, 'DADOS_INVALIDOS', 'Informe as datas de afastamento e de retorno.');
  }
  if (dataFim <= dataInicio) {
    throw new AuthError(400, 'DATAS_INVALIDAS', 'O retorno deve ser posterior ao afastamento.');
  }

  const { data, error } = await (db as any).rpc('registrar_ferias_ti', {
    p_usuario_id: colaboradorId,
    p_data_inicio: dataInicio,
    p_data_fim: dataFim,
    p_supervisor_id: supervisorId,
  });
  if (error) tratarErroRpc(String(error.message ?? ''));
  if (!data) throw erroTecnologia();
  return descreverPeriodo(db, data as PeriodoRow);
}

export async function cancelarFeriasTi(db: Db, id: string): Promise<PeriodoFeriasTi> {
  if (!UUID_PADRAO.test(id)) throw new AuthError(400, 'ID_INVALIDO', 'Identificador de período inválido.');
  const { data, error } = await (db as any).rpc('cancelar_ferias_ti', { p_periodo_id: id });
  if (error) tratarErroRpc(String(error.message ?? ''));
  if (!data) throw erroTecnologia();
  return descreverPeriodo(db, data as PeriodoRow);
}

/** Completa o período retornado pela RPC com o nome do colaborador e do supervisor. */
async function descreverPeriodo(db: Db, row: PeriodoRow): Promise<PeriodoFeriasTi> {
  const { data: espelho } = await db.from('funcionarios')
    .select('nome,usuario_id,supervisor_id').eq('id', row.funcionario_id).maybeSingle();
  const vinculo = espelho as { nome: string; usuario_id: string | null; supervisor_id: string | null } | null;
  let supervisorNome: string | null = null;
  if (vinculo?.supervisor_id) {
    const { data: supervisor } = await db.from('usuarios').select('nome').eq('id', vinculo.supervisor_id).maybeSingle();
    supervisorNome = (supervisor as { nome: string } | null)?.nome ?? null;
  }
  return {
    id: row.id,
    colaboradorId: vinculo?.usuario_id ?? null,
    colaboradorNome: vinculo?.nome ?? 'Colaborador de TI',
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    status: row.status,
    supervisorNome,
  };
}

function tratarErroRpc(mensagem: string): never {
  const erros: Record<string, [number, string, string]> = {
    NAO_AUTENTICADO: [401, 'NAO_AUTENTICADO', 'Entre na sua conta para continuar.'],
    PERFIL_NAO_PERMITIDO: [403, 'PERFIL_NAO_PERMITIDO', 'Somente Administração e Supervisão podem cadastrar férias da TI.'],
    DATAS_INVALIDAS: [400, 'DATAS_INVALIDAS', 'O retorno deve ser posterior ao afastamento.'],
    PERIODO_MUITO_LONGO: [400, 'PERIODO_MUITO_LONGO', 'O período informado excede 180 dias.'],
    COLABORADOR_INVALIDO: [400, 'COLABORADOR_INVALIDO', 'Selecione um colaborador ativo com perfil Tecnologia.'],
    SUPERVISOR_INVALIDO: [400, 'SUPERVISOR_INVALIDO', 'Selecione um supervisor ativo para responder pelas ações de acesso.'],
    PERIODO_CONFLITANTE: [409, 'PERIODO_CONFLITANTE', 'Este colaborador já possui férias registradas no período informado.'],
    PERIODO_NAO_ENCONTRADO: [404, 'PERIODO_NAO_ENCONTRADO', 'Período de férias não encontrado.'],
    PERIODO_NAO_E_DE_TI: [403, 'PERIODO_NAO_E_DE_TI', 'Este período não pertence à equipe de Tecnologia.'],
    PERIODO_CONCLUIDO: [409, 'PERIODO_CONCLUIDO', 'Este período já foi concluído.'],
    PERIODO_EM_ANDAMENTO: [409, 'PERIODO_EM_ANDAMENTO', 'O período já teve ações de acesso confirmadas e não pode ser cancelado.'],
  };
  const chave = Object.keys(erros).find((codigo) => mensagem.includes(codigo));
  if (chave) throw new AuthError(...erros[chave]);
  throw erroTecnologia();
}
