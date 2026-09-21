import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { useAuth } from '../../features/auth/auth.context'
import { perfilLabels } from '../../features/auth/auth.types'

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}

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
      <div className="header-context">
        <span className="header-kicker">Área interna</span>
        <strong>Gestão de acessos em férias</strong>
      </div>
      <div className="header-user">
        <span className="header-avatar" aria-hidden="true">{iniciais(state.usuario.nome)}</span>
        <div className="header-user-info">
          <strong>{state.usuario.nome}</strong>
          <span>{perfilLabels[state.usuario.perfil]}</span>
        </div>
        <button className="button button-ghost" onClick={handleLogout} disabled={leaving}>
          <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
          {leaving ? 'Saindo…' : 'Sair'}
        </button>
      </div>
    </header>
  )
}
