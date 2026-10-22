import { apiRequest } from '../../lib/api-client'

export type StatusPeriodo = 'CONFIRMADO' | 'CANCELADO' | 'CONCLUIDO'

export interface ColaboradorTi { id: string; nome: string; email: string }
export interface SupervisorTi { id: string; nome: string }

export interface PeriodoFeriasTi {
  id: string
  colaboradorId: string | null
  colaboradorNome: string
  dataInicio: string
  dataFim: string
  status: StatusPeriodo
  supervisorNome: string | null
}

export interface CalendarioTi {
  mes: string
  inicio: string
  fim: string
  colaboradores: ColaboradorTi[]
  supervisores: SupervisorTi[]
  periodos: PeriodoFeriasTi[]
  podeCadastrar: boolean
}

export interface NovoPeriodoTi { colaboradorId: string; dataInicio: string; dataFim: string; supervisorId: string }

export const tecnologiaApi = {
  calendario(mes: string, signal?: AbortSignal) {
    return apiRequest<CalendarioTi>(`/tecnologia/ferias?mes=${encodeURIComponent(mes)}`, { signal })
  },
  cadastrar(input: NovoPeriodoTi) {
    return apiRequest<{ item: PeriodoFeriasTi }>('/tecnologia/ferias', { method: 'POST', body: JSON.stringify(input) })
  },
  cancelar(id: string) {
    return apiRequest<{ item: PeriodoFeriasTi }>(`/tecnologia/ferias/${encodeURIComponent(id)}/cancelamento`, { method: 'PATCH', body: JSON.stringify({}) })
  },
}
