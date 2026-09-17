import { apiRequest } from '../../lib/api-client'

export type ChecklistStatus = 'PENDENTE' | 'EDITADO' | 'CONFIRMADO' | 'REJEITADO'

export interface ChecklistItem {
  id: string
  uploadId: string
  funcionarioId: string | null
  empresa: string
  cadastro: string
  nome: string
  dataInicio: string
  dataFim: string
  status: ChecklistStatus
  supervisorId: string | null
  supervisorNome: string | null
  supervisorAtivo: boolean
  revisadoPor: string | null
  revisadoEm: string | null
  criadoEm: string
}

export interface ChecklistResumo {
  pendentes: number
  editados: number
  confirmados: number
  rejeitados: number
}

export interface ChecklistListagem {
  itens: ChecklistItem[]
  total: number
  resumo: ChecklistResumo
  supervisores: Array<{ id: string; nome: string }>
}

export interface ChecklistEditInput {
  empresa: string
  cadastro: string
  nome: string
  dataInicio: string
  dataFim: string
  supervisorId: string
}

export const checklistApi = {
  listar: (status?: ChecklistStatus, offset = 0, signal?: AbortSignal) => {
    const params = new URLSearchParams({ offset: String(offset) })
    if (status) params.set('status', status)
    return apiRequest<ChecklistListagem>(`/checklist?${params.toString()}`, { signal })
  },
  editar: (id: string, input: ChecklistEditInput) =>
    apiRequest<{ item: ChecklistItem }>(`/checklist/${id}/editar`, { method: 'POST', body: JSON.stringify(input) }),
  rejeitar: (id: string) =>
    apiRequest<{ item: ChecklistItem }>(`/checklist/${id}/rejeitar`, { method: 'POST', body: '{}' }),
  confirmar: (id: string) =>
    apiRequest<{ item: ChecklistItem }>(`/checklist/${id}/confirmar`, { method: 'POST', body: '{}' }),
}
