import { useState } from 'react'
import { useAuth } from '../../features/auth/auth.context'
import { perfilLabels } from '../../features/auth/auth.types'

export function Header() {
  const { state, logout } = useAuth()
  const [leaving, setLeaving] = useState(false)
  if (state.status !== 'authenticated') return null

  async function handleLogout() {
    setLeaving(true)
    try { await logout() }
    finally { setLeaving(false) }
  }

  return (
    <header className="app-header">
      <div>
        <span className="header-kicker">QCAcesso</span>
        <strong>{state.usuario.nome}</strong>
        <span>{perfilLabels[state.usuario.perfil]}</span>
      </div>
      <button className="button button-secondary" onClick={handleLogout} disabled={leaving}>
        {leaving ? 'Saindo…' : 'Sair'}
      </button>
    </header>
  )
}
