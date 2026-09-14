import { apiRequest } from '../../lib/api-client'
import type { UsuarioAutenticado } from './auth.types'

interface AuthResponse { usuario: UsuarioAutenticado }
export const authApi = {
  login: (email: string, senha: string) =>
    apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) }),
  me: () => apiRequest<AuthResponse>('/auth/me'),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST', body: '{}' }),
}
