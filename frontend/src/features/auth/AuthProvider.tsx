import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError } from '../../lib/api-client'
import { authApi } from './auth.api'
import { AuthContext } from './auth.context'
import type { AuthState } from './auth.context'
import { PERFIS } from './auth.types'
import type { UsuarioAutenticado } from './auth.types'

function checkProfile(usuario: UsuarioAutenticado) {
  if (!PERFIS.includes(usuario.perfil)) throw new ApiError(403, 'PERFIL_INVALIDO', 'Seu perfil não tem acesso ao sistema.')
  return usuario
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const revision = useRef(0)

  const reload = useCallback(() => {
    const current = ++revision.current
    // setState somente nos callbacks da requisição (nunca de forma síncrona no efeito).
    return authApi.me().then(({ usuario }) => {
      const checked = checkProfile(usuario)
      if (current === revision.current) setState({ status: 'authenticated', usuario: checked })
    }).catch((error: unknown) => {
      if (current !== revision.current) return
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        setState({ status: 'anonymous', message: error.status === 403 ? error.message : undefined })
      } else {
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Não foi possível verificar sua sessão.' })
      }
    })
  }, [])

  useEffect(() => {
    const revisionRef = revision
    void reload()
    const recheck = () => { if (document.visibilityState === 'visible') void reload() }
    window.addEventListener('focus', recheck)
    const interval = window.setInterval(recheck, 60_000)
    return () => {
      revisionRef.current++
      window.removeEventListener('focus', recheck)
      window.clearInterval(interval)
    }
  }, [reload])

  const login = useCallback(async (email: string, senha: string) => {
    // Invalida verificações antigas, que não podem restaurar uma sessão anterior.
    ++revision.current
    const { usuario } = await authApi.login(email, senha)
    ++revision.current
    setState({ status: 'authenticated', usuario: checkProfile(usuario) })
  }, [])

  const logout = useCallback(async () => {
    ++revision.current
    await authApi.logout()
    ++revision.current
    setState({ status: 'anonymous' })
  }, [])

  return <AuthContext.Provider value={{ state, login, logout, reload }}>{children}</AuthContext.Provider>
}
