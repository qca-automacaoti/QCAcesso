import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { Logo } from '../../components/Logo'
import { authApi } from './auth.api'

interface TrocaSenhaPageProps {
  nome: string
  onConcluir: () => Promise<void>
  onSair: () => Promise<void>
}

const MINIMO = 8

/** Troca obrigatória no primeiro acesso: o sistema só é liberado depois dela. */
export function TrocaSenhaPage({ nome, onConcluir, onSair }: TrocaSenhaPageProps) {
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (enviando) return
    if (novaSenha !== confirmacao) { setErro('A confirmação não confere com a nova senha.'); return }
    if (novaSenha === senhaAtual) { setErro('A nova senha precisa ser diferente da provisória.'); return }
    setErro('')
    setEnviando(true)
    try {
      await authApi.trocarSenha(senhaAtual, novaSenha)
      await onConcluir()
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível alterar a senha. Tente novamente.')
      setEnviando(false)
    }
  }

  return (
    <div className="login-page">
      <aside className="brand-panel" aria-label="QCAcesso">
        <Logo href="/app" label="QCAcesso" variant="light" />
        <div className="brand-message">
          <span className="eyebrow">PRIMEIRO ACESSO</span>
          <h1>Defina a sua<br />senha de acesso.</h1>
          <p>A senha recebida da Administração é provisória e vale apenas para esta etapa.</p>
        </div>
        <span className="brand-footer">Sistema de uso interno · Acesso restrito</span>
        <div className="brand-pattern" aria-hidden="true">{'IOIOIOIOIOIOIOIOIOIOIOIOIOIOIOIO'.repeat(2)}<br />{'OIOIOIOIOIOIOIOIOIOIOIOIOIOIOIOI'.repeat(2)}</div>
      </aside>
      <main className="login-main" id="conteudo">
        <div className="login-form-wrap">
          <div className="login-heading">
            <span className="section-label">Troca obrigatória</span>
            <h2>Olá, {nome.trim().split(/\s+/)[0]}</h2>
            <p>Para continuar, substitua a senha provisória por uma senha só sua.</p>
          </div>
          <form onSubmit={handleSubmit} className="login-form" aria-busy={enviando}>
            <div className="field">
              <label htmlFor="senha-atual">Senha provisória</label>
              <input id="senha-atual" name="senha-atual" type="password" autoComplete="current-password" required
                maxLength={256} placeholder="A senha que você recebeu" value={senhaAtual}
                onChange={(evento) => setSenhaAtual(evento.target.value)} disabled={enviando} />
            </div>
            <div className="field">
              <label htmlFor="nova-senha">Nova senha</label>
              <div className="password-field">
                <input id="nova-senha" name="nova-senha" type={mostrar ? 'text' : 'password'} autoComplete="new-password"
                  required minLength={MINIMO} maxLength={128} placeholder={`No mínimo ${MINIMO} caracteres`} value={novaSenha}
                  onChange={(evento) => setNovaSenha(evento.target.value)} disabled={enviando} />
                <button type="button" className="password-toggle" aria-controls="nova-senha" aria-pressed={mostrar}
                  onClick={() => setMostrar(!mostrar)} disabled={enviando}>
                  {mostrar ? <EyeOff size={16} strokeWidth={1.75} aria-hidden="true" /> : <Eye size={16} strokeWidth={1.75} aria-hidden="true" />}
                  {mostrar ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
            <div className="field">
              <label htmlFor="confirmacao">Confirme a nova senha</label>
              <input id="confirmacao" name="confirmacao" type={mostrar ? 'text' : 'password'} autoComplete="new-password"
                required minLength={MINIMO} maxLength={128} placeholder="Repita a nova senha" value={confirmacao}
                onChange={(evento) => setConfirmacao(evento.target.value)} disabled={enviando} />
            </div>
            {erro && <p className="notice notice-error" role="alert">{erro}</p>}
            <button className="button button-primary" type="submit" disabled={enviando}>
              {enviando ? 'Salvando…' : 'Salvar e entrar'}
              {!enviando && <span aria-hidden="true"><ArrowRight size={18} strokeWidth={1.75} /></span>}
            </button>
          </form>
          <p className="login-help">
            <ShieldCheck size={15} strokeWidth={1.75} aria-hidden="true" /> A senha provisória deixa de funcionar assim que a troca for concluída.
          </p>
          <button className="button button-ghost login-leave" onClick={() => void onSair()} disabled={enviando}>Sair da conta</button>
        </div>
        <footer className="login-footer">QCA · Controle de acesso</footer>
      </main>
    </div>
  )
}
