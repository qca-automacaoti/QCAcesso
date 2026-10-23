import { useState } from 'react'
import { perfilLabels } from '../auth/auth.types'
import type { EdicaoUsuario, PerfilUsuario, UsuarioAdmin } from './administracao.api'

interface UsuarioRowProps {
  item: UsuarioAdmin
  perfis: Array<{ value: PerfilUsuario; label: string }>
  podeEditar: boolean
  ocupado: boolean
  onSalvar: (item: UsuarioAdmin, input: EdicaoUsuario) => Promise<boolean>
}

function formularioDoItem(item: UsuarioAdmin): EdicaoUsuario {
  return { perfil: item.perfil, ativo: item.ativo, nome: item.nome, email: item.email, senha: '' }
}

function formatarData(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))
}

export function UsuarioRow({ item, perfis, podeEditar, ocupado, onSalvar }: UsuarioRowProps) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState<EdicaoUsuario>(() => formularioDoItem(item))

  function abrir() { setForm(formularioDoItem(item)); setEditando(true) }
  function fechar() { setForm(formularioDoItem(item)); setEditando(false) }

  async function salvar(event: React.FormEvent) {
    event.preventDefault()
    // A senha só é enviada quando preenchida: em branco, a atual é mantida.
    const salvo = await onSalvar(item, { ...form, senha: form.senha?.trim() ? form.senha : undefined })
    if (salvo) setEditando(false)
  }

  if (editando) {
    return (
      <article className="user-row user-row-editing">
        <form className="user-edit-grid" onSubmit={salvar}>
          <label>Nome
            <input required minLength={2} maxLength={120} value={form.nome ?? ''}
              onChange={(evento) => setForm({ ...form, nome: evento.target.value })} disabled={ocupado} />
          </label>
          <label>E-mail
            <input required type="email" maxLength={254} value={form.email ?? ''} autoCapitalize="none" spellCheck={false}
              onChange={(evento) => setForm({ ...form, email: evento.target.value })} disabled={ocupado} />
          </label>
          <label>Nova senha
            <input type="password" minLength={8} maxLength={128} autoComplete="new-password" placeholder="Manter a atual"
              value={form.senha ?? ''} onChange={(evento) => setForm({ ...form, senha: evento.target.value })} disabled={ocupado} />
          </label>
          <label>Perfil
            <select value={form.perfil} onChange={(evento) => setForm({ ...form, perfil: evento.target.value as PerfilUsuario })} disabled={ocupado}>
              {perfis.map((perfil) => <option key={perfil.value} value={perfil.value}>{perfil.label}</option>)}
            </select>
          </label>
          <label className="user-active">
            <input type="checkbox" checked={form.ativo} onChange={(evento) => setForm({ ...form, ativo: evento.target.checked })} disabled={ocupado} /> Ativo
          </label>
          <div className="checklist-actions">
            <button className="button button-primary" type="submit" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar'}</button>
            <button className="button button-secondary" type="button" onClick={fechar} disabled={ocupado}>Cancelar</button>
          </div>
        </form>
        {form.senha?.trim() && <p className="muted-text">A nova senha será provisória: o usuário precisará defini-la no próximo acesso.</p>}
      </article>
    )
  }

  return (
    <article className="user-row">
      <div className="user-main">
        <strong>{item.nome}</strong>
        <span>{item.email}</span>
        <small>Cadastro em {formatarData(item.criadoEm)}</small>
      </div>
      <span className="audit-type">{perfilLabels[item.perfil]}</span>
      <span className={item.ativo ? 'status-pill status-confirmado' : 'status-pill status-cancelado'}>{item.ativo ? 'Ativo' : 'Inativo'}</span>
      <div className="checklist-actions">
        {podeEditar && <button className="button button-secondary" onClick={abrir} disabled={ocupado}>Editar</button>}
      </div>
    </article>
  )
}
