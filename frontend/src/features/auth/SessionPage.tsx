import { useState } from 'react'
import { useAuth } from './auth.context'
import { perfilLabels } from './auth.types'

export function SessionPage() {
  const { state, logout } = useAuth()
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState('')
  async function handleLogout() {
    setLeaving(true)
    setError('')
    try { await logout() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível sair. Tente novamente.') }
    finally { setLeaving(false) }
  }
  if (state.status !== 'authenticated') return null // ProtectedRoute já redireciona.
  const { usuario } = state
  return (
    <main className="session-page">
      <a className="brand" href="/app" aria-label="QCAcesso, início">
        <span className="brand-mark">QCA<span className="brand-dot">.</span></span>
        <span className="brand-name">ACESSO</span>
      </a>
      <section className="session-content" aria-labelledby="session-title">
        <span className="section-label">MINHA CONTA</span>
        <h1 id="session-title">Bem-vindo, {usuario.nome}.</h1>
        <p>Você está conectado ao QCAcesso.</p>
        <div className="session-card">
          <h2>Dados de acesso</h2>
          <dl className="session-details">
            <div><dt>Nome</dt><dd>{usuario.nome}</dd></div>
            <div><dt>Perfil</dt><dd>{perfilLabels[usuario.perfil]}</dd></div>
            <div><dt>E-mail</dt><dd>{usuario.email}</dd></div>
            <div><dt>Situação</dt><dd>Acesso ativo</dd></div>
          </dl>
        </div>
        <div className="session-actions">
          <button className="button button-secondary" onClick={handleLogout} disabled={leaving}>
            {leaving ? 'Saindo…' : 'Sair da conta'}
          </button>
          {error && <p className="notice notice-error" role="alert">{error}</p>}
        </div>
      </section>
    </main>
  )
}
