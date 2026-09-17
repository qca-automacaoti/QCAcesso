import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../config/database.types';
import { AuthError } from '../auth/auth.types';

type Db = SupabaseClient<Database>;
type PeriodoConflito = Pick<Database['public']['Tables']['periodos_ferias']['Row'], 'id' | 'data_inicio' | 'data_fim' | 'checklist_origem_id'>;

export async function validarConflitoPeriodo(
  db: Db,
  funcionarioId: string,
  dataInicio: string,
  dataFim: string,
  checklistOrigemId: string,
) {
  const { data, error } = await db.from('periodos_ferias')
    .select('id,data_inicio,data_fim,checklist_origem_id')
    .eq('funcionario_id', funcionarioId)
    .eq('status', 'CONFIRMADO')
    .lte('data_inicio', dataFim)
    .gte('data_fim', dataInicio)
    .limit(1);
  if (error) {
    throw new AuthError(503, 'CHECKLIST_INDISPONIVEL', 'Não foi possível validar conflitos de férias.');
  }
  const periodos = (data ?? []) as unknown as PeriodoConflito[];
  const conflito = periodos.find((periodo) => periodo.checklist_origem_id !== checklistOrigemId);
  if (conflito) {
    throw new AuthError(409, 'PERIODO_CONFLITANTE', 'Já existe um período confirmado para este funcionário nessa faixa de datas.');
  }
}
