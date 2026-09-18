import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TipoAcao, TipoAlerta } from '../../config/database.types';
import type { createMailer } from '../../config/mailer';
import { renderizarAlerta } from './email.templates';

type Db = SupabaseClient<Database>;
type Mailer = ReturnType<typeof createMailer>;

interface JobConfig {
  timezone: string;
  fromEmail: string;
  frontendOrigin: string;
}

interface ControleAlerta {
  id: string;
  periodo_ferias_id: string;
  tipo_acao: TipoAcao;
  data_programada: string;
  status: 'PENDENTE' | 'ATRASADO';
  supervisor_id: string | null;
}

interface PeriodoAlerta {
  id: string;
  funcionario_id: string;
  data_inicio: string;
  data_fim: string;
}

interface FuncionarioAlerta {
  id: string;
  nome: string;
  empresa: string;
  cadastro: string;
}

interface Destinatario {
  id: string | null;
  nome: string;
  email: string | null;
}

interface AlertaCompleto {
  controle: ControleAlerta;
  periodo: PeriodoAlerta;
  funcionario: FuncionarioAlerta;
}

const PAGE_SIZE = 500;

function dataNaZona(data: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(data);
}

function adicionarDias(data: string, dias: number) {
  const resultado = new Date(`${data}T00:00:00.000Z`);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado.toISOString().slice(0, 10);
}

async function buscarControles(
  db: Db,
  filtros: { tipo?: TipoAcao; data?: string; atrasadosAntesDe?: string; status?: 'PENDENTE' | 'ATRASADO' },
) {
  const resultados: ControleAlerta[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query: any = db.from('controle_acesso')
      .select('id,periodo_ferias_id,tipo_acao,data_programada,status,supervisor_id')
      .order('data_programada', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (filtros.tipo) query = query.eq('tipo_acao', filtros.tipo);
    if (filtros.data) query = query.eq('data_programada', filtros.data).eq('status', 'PENDENTE');
    if (filtros.status) query = query.eq('status', filtros.status);
    if (filtros.atrasadosAntesDe) query = query.lt('data_programada', filtros.atrasadosAntesDe);
    const { data, error } = await query;
    if (error) throw new Error('Falha ao consultar ações programadas para os alertas.');
    const page = (data ?? []) as ControleAlerta[];
    resultados.push(...page);
    if (page.length < PAGE_SIZE) return resultados;
  }
}

async function buscarDadosRelacionados(db: Db, controles: ControleAlerta[]) {
  const idsPeriodos = [...new Set(controles.map((item) => item.periodo_ferias_id))];
  const periodos: PeriodoAlerta[] = [];
  for (let offset = 0; offset < idsPeriodos.length; offset += PAGE_SIZE) {
    const { data, error } = await db.from('periodos_ferias')
      .select('id,funcionario_id,data_inicio,data_fim')
      .eq('status', 'CONFIRMADO')
      .in('id', idsPeriodos.slice(offset, offset + PAGE_SIZE));
    if (error) throw new Error('Falha ao consultar períodos associados aos alertas.');
    periodos.push(...((data ?? []) as PeriodoAlerta[]));
  }

  const idsFuncionarios = [...new Set(periodos.map((item) => item.funcionario_id))];
  const funcionarios: FuncionarioAlerta[] = [];
  for (let offset = 0; offset < idsFuncionarios.length; offset += PAGE_SIZE) {
    const { data, error } = await db.from('funcionarios')
      .select('id,nome,empresa,cadastro')
      .in('id', idsFuncionarios.slice(offset, offset + PAGE_SIZE));
    if (error) throw new Error('Falha ao consultar funcionários associados aos alertas.');
    funcionarios.push(...((data ?? []) as FuncionarioAlerta[]));
  }

  const idsSupervisores = [...new Set(controles.flatMap((item) => item.supervisor_id ? [item.supervisor_id] : []))];
  const supervisores: Array<{ id: string; nome: string; email: string; perfil: string; ativo: boolean }> = [];
  for (let offset = 0; offset < idsSupervisores.length; offset += PAGE_SIZE) {
    const { data, error } = await db.from('usuarios')
      .select('id,nome,email,perfil,ativo')
      .in('id', idsSupervisores.slice(offset, offset + PAGE_SIZE));
    if (error) throw new Error('Falha ao consultar responsáveis pelos alertas.');
    supervisores.push(...((data ?? []) as typeof supervisores));
  }

  const { data: gestoresData, error: gestoresError } = await db.from('usuarios')
    .select('id,nome,email,perfil,ativo')
    .eq('ativo', true)
    .in('perfil', ['ADMIN', 'RH']);
  if (gestoresError) throw new Error('Falha ao consultar gestores para escalonamento.');

  const periodoPorId = new Map(periodos.map((item) => [item.id, item]));
  const funcionarioPorId = new Map(funcionarios.map((item) => [item.id, item]));
  const supervisorPorId = new Map(supervisores.map((item) => [item.id, item]));
  const alertas = controles.flatMap((controle) => {
    const periodo = periodoPorId.get(controle.periodo_ferias_id);
    const funcionario = periodo ? funcionarioPorId.get(periodo.funcionario_id) : undefined;
    return periodo && funcionario ? [{ controle, periodo, funcionario }] : [];
  });

  return {
    alertas,
    supervisorPorId,
    gestores: (gestoresData ?? []) as typeof supervisores,
  };
}

async function registrarEvento(db: Db, id: string, descricao: string) {
  await (db as any).from('logs_atividade').insert({
    usuario_id: null,
    tipo_evento: 'ENVIO_ALERTA',
    entidade_afetada: 'alertas',
    entidade_id: id,
    descricao,
  });
}

async function enviarParaDestinatario(
  db: Db,
  mailer: Mailer,
  config: JobConfig,
  hoje: string,
  tipoAlerta: TipoAlerta,
  item: AlertaCompleto,
  supervisorId: string | null,
  destinatario: Destinatario,
) {
  const chave = `${item.controle.id}:${tipoAlerta}:${hoje}:${destinatario.id ?? 'sem-destinatario'}`;
  const { data: reserva, error: reservaError } = await (db as any).from('alertas')
    .upsert({
      controle_acesso_id: item.controle.id,
      supervisor_id: destinatario.id === supervisorId ? supervisorId : null,
      destinatario_id: destinatario.id,
      tipo_alerta: tipoAlerta,
      chave_idempotencia: chave,
      status_envio: 'FALHA',
    }, { onConflict: 'chave_idempotencia', ignoreDuplicates: true })
    .select('id')
    .maybeSingle();
  if (reservaError) throw new Error('Falha ao registrar tentativa de alerta.');
  if (!reserva?.id) return; // Uma instância já reservou esta notificação diária.

  if (!destinatario.email) {
    await registrarEvento(db, reserva.id, `Alerta ${tipoAlerta} sem destinatário ativo ou com e-mail cadastrado.`);
    return;
  }

  const email = renderizarAlerta({
    tipoAlerta,
    tipoAcao: item.controle.tipo_acao,
    nome: item.funcionario.nome,
    empresa: item.funcionario.empresa,
    cadastro: item.funcionario.cadastro,
    dataProgramada: item.controle.data_programada,
    dataInicio: item.periodo.data_inicio,
    dataFim: item.periodo.data_fim,
    urlControle: `${config.frontendOrigin}/app/controle-acesso`,
  });

  try {
    await mailer.sendMail({ from: config.fromEmail, to: destinatario.email, ...email });
  } catch {
    await (db as any).from('alertas').update({ status_envio: 'FALHA' }).eq('id', reserva.id);
    await registrarEvento(db, reserva.id, `Falha no envio automático do alerta ${tipoAlerta}.`);
    return;
  }

  const { error: updateError } = await (db as any).from('alertas').update({ status_envio: 'ENVIADO' }).eq('id', reserva.id);
  if (updateError) {
    await registrarEvento(db, reserva.id, `E-mail do alerta ${tipoAlerta} enviado; não foi possível atualizar o registro.`);
    return;
  }
  await registrarEvento(db, reserva.id, `Alerta ${tipoAlerta} enviado por e-mail.`);
}

async function enviarLembretes(
  db: Db,
  mailer: Mailer,
  config: JobConfig,
  tipoAcao: TipoAcao,
  agora = new Date(),
) {
  const hoje = dataNaZona(agora, config.timezone);
  const amanha = adicionarDias(hoje, 1);
  const controles = await buscarControles(db, { tipo: tipoAcao, data: amanha });
  if (controles.length === 0) return;
  const { alertas, supervisorPorId } = await buscarDadosRelacionados(db, controles);
  const tipoAlerta: TipoAlerta = tipoAcao === 'BLOQUEIO' ? 'LEMBRETE_BLOQUEIO' : 'LEMBRETE_DESBLOQUEIO';

  for (const item of alertas) {
    const supervisor = item.controle.supervisor_id ? supervisorPorId.get(item.controle.supervisor_id) : undefined;
    const valido = supervisor?.ativo && supervisor.perfil === 'SUPERVISOR';
    const destinatario: Destinatario = valido && supervisor
      ? { id: supervisor.id, nome: supervisor.nome, email: supervisor.email }
      : { id: null, nome: 'Responsável', email: null };
    await enviarParaDestinatario(db, mailer, config, hoje, tipoAlerta, item, item.controle.supervisor_id, destinatario);
  }
}

export async function enviarLembretesBloqueio(db: Db, mailer: Mailer, config: JobConfig, agora?: Date) {
  await enviarLembretes(db, mailer, config, 'BLOQUEIO', agora);
}

export async function enviarLembretesDesbloqueio(db: Db, mailer: Mailer, config: JobConfig, agora?: Date) {
  await enviarLembretes(db, mailer, config, 'DESBLOQUEIO', agora);
}

export async function escalarAtrasos(db: Db, mailer: Mailer, config: JobConfig, agora = new Date()) {
  const hoje = dataNaZona(agora, config.timezone);
  const { error: marcarError } = await (db as any).from('controle_acesso')
    .update({ status: 'ATRASADO' })
    .eq('status', 'PENDENTE')
    .lt('data_programada', hoje);
  if (marcarError) throw new Error('Falha ao atualizar ações vencidas.');

  const controles = await buscarControles(db, { status: 'ATRASADO', atrasadosAntesDe: hoje });
  if (controles.length === 0) return;
  const { alertas, supervisorPorId, gestores } = await buscarDadosRelacionados(db, controles);
  for (const item of alertas) {
    const supervisor = item.controle.supervisor_id ? supervisorPorId.get(item.controle.supervisor_id) : undefined;
    const destinatarios = new Map<string, Destinatario>();
    if (supervisor?.ativo && supervisor.perfil === 'SUPERVISOR') {
      destinatarios.set(supervisor.id, { id: supervisor.id, nome: supervisor.nome, email: supervisor.email });
    }
    for (const gestor of gestores) {
      if (gestor.ativo) destinatarios.set(gestor.id, { id: gestor.id, nome: gestor.nome, email: gestor.email });
    }
    const alvos = destinatarios.size ? [...destinatarios.values()] : [{ id: null, nome: 'Gestor', email: null }];
    for (const destinatario of alvos) {
      await enviarParaDestinatario(
        db, mailer, config, hoje, 'ESCALONAMENTO_ATRASO', item, item.controle.supervisor_id, destinatario,
      );
    }
  }
}
