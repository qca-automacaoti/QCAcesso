import { apiRequest } from '../../lib/api-client'

export type PerfilUsuario = 'ADMIN' | 'RH' | 'SUPERVISOR' | 'AUDITOR' | 'TECNOLOGIA'
export interface UsuarioAdmin { id: string; nome: string; email: string; perfil: PerfilUsuario; ativo: boolean; criadoEm: string }
export interface UsuariosListagem { itens: UsuarioAdmin[]; total: number }
/** Nome, e-mail e senha são opcionais: ausentes, a edição altera só perfil e status. */
export interface EdicaoUsuario { perfil: PerfilUsuario; ativo: boolean; nome?: string; email?: string; senha?: string }
export const administracaoApi = {
  listar(busca = '', offset = 0, signal?: AbortSignal) {
    const params = new URLSearchParams({ offset: String(offset) }); if (busca) params.set('busca', busca)
    return apiRequest<UsuariosListagem>(`/usuarios?${params}`, { signal })
  },
  atualizar(id: string, input: EdicaoUsuario) {
    return apiRequest<{ item: UsuarioAdmin }>(`/usuarios/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) })
  },
  criar(input: { nome: string; email: string; senha: string; perfil: PerfilUsuario }) {
    return apiRequest<{ item: UsuarioAdmin }>('/usuarios', { method: 'POST', body: JSON.stringify(input) })
  },
}
