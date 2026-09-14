import { createContext, useContext } from 'react'
import type { UsuarioAutenticado } from './auth.types'

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous'; message?: string }
  | { status: 'authenticated'; usuario: UsuarioAutenticado }
  | { status: 'error'; message: string }

export interface AuthContextValue {
  state: AuthState
  login: (email: string, senha: string) => Promise<void>
  logout: () => Promise<void>
  reload: () => Promise<void>
}
export const AuthContext = createContext<AuthContextValue | null>(null)
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider não encontrado.')
  return context
}
