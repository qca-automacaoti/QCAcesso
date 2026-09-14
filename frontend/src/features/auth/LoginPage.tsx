import { useState } from 'react'
import type { FormEvent } from 'react'

interface LoginPageProps {
  onLogin: (email: string, senha: string) => Promise<void>
  sessionMessage?: string
}

export function LoginPage({ onLogin, sessionMessage }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      await onLogin(email.trim(), senha)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <aside className="brand-panel" aria-label="QCAcesso">
        <a className="brand brand-light" href="/login" aria-label="QCAcesso, página de login">
          <span className="brand-mark">QCA<span className="brand-dot">.</span></span>
          <span className="brand-name">ACESSO</span>
        </a>
        <div className="brand-message">
          <span className="eyebrow">QUEIROZ CAVALCANTI ADVOCACIA</span>
          <h1>Gestão de acessos<br />durante as férias.</h1>
          <p>Um ponto de acesso para a equipe responsável pelo bloqueio e desbloqueio de usuários.</p>
          <div className="brand-rule" />
        </div>
        <span className="brand-footer">Sistema de uso interno</span>
      </aside>
      <main className="login-main" id="conteudo">
        <div className="login-form-wrap">
          <div className="login-heading">
            <span className="section-label">QCAcesso</span>
            <h2>Entrar na sua conta</h2>
            <p>Informe seu e-mail e senha para continuar.</p>
          </div>
          <form onSubmit={handleSubmit} className="login-form" aria-busy={submitting}>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" autoComplete="username" required maxLength={254}
                placeholder="seu e-mail" value={email} onChange={(event) => setEmail(event.target.value)}
                disabled={submitting} autoCapitalize="none" spellCheck={false} />
            </div>
            <div className="field">
              <label htmlFor="senha">Senha</label>
              <div className="password-field">
                <input id="senha" name="senha" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                  required maxLength={256} placeholder="Digite sua senha" value={senha}
                  onChange={(event) => setSenha(event.target.value)} disabled={submitting} />
                <button type="button" className="password-toggle" aria-controls="senha" aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)} disabled={submitting}>
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
            {(error || sessionMessage) && <p className="notice notice-error" role="alert">{error || sessionMessage}</p>}
            <button className="button button-primary" type="submit" disabled={submitting}>
              {submitting ? 'Entrando…' : 'Entrar'}
              {!submitting && <span aria-hidden="true">→</span>}
            </button>
          </form>
          <p className="login-help">Precisa de acesso? Entre em contato com o administrador do sistema.</p>
        </div>
        <footer className="login-footer">QCA · Controle de acesso</footer>
      </main>
    </div>
  )
}
