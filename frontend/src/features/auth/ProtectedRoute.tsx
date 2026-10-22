import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth.context'
import { rotaInicial } from './auth.types'
import type { PerfilUsuario } from './auth.types'

// Rota protegida: exige sessão e, opcionalmente, um dos perfis informados.
// A autorização definitiva é sempre do backend (requirePerfil); aqui é só navegação.
export function ProtectedRoute({ perfis }: { perfis?: readonly PerfilUsuario[] }) {
  const { state } = useAuth()
  const location = useLocation()
  if (state.status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (perfis && !perfis.includes(state.usuario.perfil)) return <AcessoNegado inicio={rotaInicial(state.usuario.perfil)} />
  return <Outlet />
}

function AcessoNegado({ inicio }: { inicio: string }) {
  return (
    <main className="centered-state">
      <h1>Acesso negado</h1>
      <p role="alert">Seu perfil não tem permissão para acessar esta página.</p>
      <Link className="button button-secondary" to={inicio}>Voltar ao início</Link>
    </main>
  )
}
