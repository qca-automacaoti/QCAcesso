import { apiRequest } from '../../lib/api-client'

export type ControleStatus = 'PENDENTE' | 'ATRASADO' | 'CONFIRMADO' | 'CANCELADO'
export type ControleTipo = 'BLOQUEIO' | 'DESBLOQUEIO'

export interface ControleAcessoItem {
  id: string
  tipo: ControleTipo
  status: ControleStatus
  dataProgramada: string
  confirmadoEm: string | null
  periodoInicio: string
  periodoFim: string
  funcionario: { id: string; nome: string; empresa: string; cadastro: string }
  supervisorNome: string | null
}

export interface ControleAcessoResumo {
  pendentes: number
  atrasados: number
  confirmados: number
  cancelados: number
}

export interface ControleAcessoListagem {
  itens: ControleAcessoItem[]
  total: number
  resumo: ControleAcessoResumo
}

export const controleAcessoApi = {
  listar(status?: ControleStatus, tipo?: ControleTipo, offset = 0, signal?: AbortSignal) {
    const params = new URLSearchParams({ offset: String(offset) })
    if (status) params.set('status', status)
    if (tipo) params.set('tipo', tipo)
    return apiRequest<ControleAcessoListagem>(`/controle-acesso?${params}`, { signal })
  },
  async confirmar(id: string) {
    await apiRequest<{ item: unknown }>(`/controle-acesso/${encodeURIComponent(id)}/confirmar`, { method: 'POST', body: '{}' })
  },
}
