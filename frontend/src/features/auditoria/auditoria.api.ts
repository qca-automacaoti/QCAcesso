import { apiRequest } from '../../lib/api-client'
export type TipoEvento = 'UPLOAD' | 'EDICAO_CHECKLIST' | 'CONFIRMACAO_BLOQUEIO' | 'CONFIRMACAO_DESBLOQUEIO' | 'ENVIO_ALERTA' | 'CONFIGURACAO_ALTERADA'
export interface AuditoriaItem { id: string; tipo: TipoEvento; entidade: string | null; entidadeId: string | null; descricao: string; dataHora: string; usuario: { id: string; nome: string; email: string } | null }
export interface AuditoriaListagem { itens: AuditoriaItem[]; total: number }
export const auditoriaApi = { listar(filtros: { tipo?: TipoEvento; busca?: string; offset?: number }, signal?: AbortSignal) { const params = new URLSearchParams({ offset: String(filtros.offset ?? 0) }); if (filtros.tipo) params.set('tipo', filtros.tipo); if (filtros.busca) params.set('busca', filtros.busca); return apiRequest<AuditoriaListagem>(`/auditoria?${params}`, { signal }) } }
