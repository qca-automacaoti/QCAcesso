import { apiRequest } from '../../lib/api-client'

export type PerfilUsuario = 'ADMIN' | 'RH' | 'SUPERVISOR' | 'AUDITOR'
export interface UsuarioAdmin { id: string; nome: string; email: string; perfil: PerfilUsuario; ativo: boolean; criadoEm: string }
export interface UsuariosListagem { itens: UsuarioAdmin[]; total: number }
export const administracaoApi = {
  listar(busca = '', offset = 0, signal?: AbortSignal) {
    const params = new URLSearchParams({ offset: String(offset) }); if (busca) params.set('busca', busca)
    return apiRequest<UsuariosListagem>(`/usuarios?${params}`, { signal })
  },
  atualizar(id: string, perfil: PerfilUsuario, ativo: boolean) {
    return apiRequest<{ item: UsuarioAdmin }>(`/usuarios/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ perfil, ativo }) })
  },
}
