import { useState } from 'react'
import type { ChecklistEditInput, ChecklistItem } from './checklist.api'

interface ChecklistRowProps {
  item: ChecklistItem
  supervisors: Array<{ id: string; nome: string }>
  readOnly?: boolean
  busy?: boolean
  onEdit: (id: string, input: ChecklistEditInput) => Promise<boolean>
  onConfirm: (id: string) => Promise<void>
  onReject: (id: string) => Promise<void>
}

const statusLabels: Record<ChecklistItem['status'], string> = {
  PENDENTE: 'Pendente',
  EDITADO: 'Editado',
  CONFIRMADO: 'Confirmado',
  REJEITADO: 'Rejeitado',
}

function formularioDoItem(item: ChecklistItem, supervisors: Array<{ id: string; nome: string }>): ChecklistEditInput {
  return {
    empresa: item.empresa,
    cadastro: item.cadastro,
    nome: item.nome,
    dataInicio: item.dataInicio,
    dataFim: item.dataFim,
    supervisorId: item.supervisorAtivo && supervisors.some((supervisor) => supervisor.id === item.supervisorId) ? item.supervisorId ?? '' : '',
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value + 'T00:00:00'))
}

export function ChecklistRow({ item, supervisors, readOnly, busy, onEdit, onConfirm, onReject }: ChecklistRowProps) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<ChecklistEditInput>(() => formularioDoItem(item, supervisors))

  async function handleSave() {
    const salvo = await onEdit(item.id, form)
    if (salvo) setEditing(false)
  }

  if (editing) {
    return (
      <article className="checklist-row checklist-row-editing">
        <div className="checklist-edit-grid">
          <label>Empresa<input value={form.empresa} onChange={(event) => setForm({ ...form, empresa: event.target.value })} disabled={busy} /></label>
          <label>Cadastro<input value={form.cadastro} onChange={(event) => setForm({ ...form, cadastro: event.target.value })} disabled={busy} /></label>
          <label>Nome<input value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} disabled={busy} /></label>
          <label>Início<input type="date" value={form.dataInicio} onChange={(event) => setForm({ ...form, dataInicio: event.target.value })} disabled={busy} /></label>
          <label>Fim<input type="date" value={form.dataFim} onChange={(event) => setForm({ ...form, dataFim: event.target.value })} disabled={busy} /></label>
          <label>Supervisor
            <select value={form.supervisorId} onChange={(event) => setForm({ ...form, supervisorId: event.target.value })} disabled={busy}>
              <option value="">Selecione um supervisor</option>
              {supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.nome}</option>)}
            </select>
          </label>
        </div>
        {supervisors.length === 0 && <p className="muted-text">Cadastre um usuário ativo com perfil Supervisor para associar este registro.</p>}
        <div className="checklist-actions">
          <button className="button button-primary" onClick={() => void handleSave()} disabled={busy}>Salvar</button>
          <button className="button button-secondary" onClick={() => { setForm(formularioDoItem(item, supervisors)); setEditing(false) }} disabled={busy}>Cancelar</button>
        </div>
      </article>
    )
  }

  return (
    <article className="checklist-row">
      <div className="checklist-main">
        <strong>{item.nome}</strong>
        <span>{item.empresa} · Cadastro {item.cadastro}</span>
      </div>
      <div className="checklist-dates">
        <span>{formatDate(item.dataInicio)}</span>
        <span>{formatDate(item.dataFim)}</span>
      </div>
      <div className="checklist-supervisor">
        <span>Supervisor</span>
        <strong>{item.supervisorAtivo ? item.supervisorNome : (item.supervisorId ? 'Supervisor inativo' : 'Não associado')}</strong>
      </div>
      <span className={`status-pill status-${item.status.toLowerCase()}`}>{statusLabels[item.status]}</span>
      <div className="checklist-actions">
        {!readOnly && item.status !== 'CONFIRMADO' && item.status !== 'REJEITADO' && (
          <>
            <button className="button button-secondary" onClick={() => { setForm(formularioDoItem(item, supervisors)); setEditing(true) }} disabled={busy}>Editar</button>
            <button className="button button-secondary" onClick={() => {
              if (window.confirm(`Rejeitar o registro de ${item.nome}?`)) void onReject(item.id)
            }} disabled={busy}>Rejeitar</button>
            <button className="button button-primary" onClick={() => onConfirm(item.id)} disabled={busy || !item.funcionarioId || !item.supervisorAtivo}>Confirmar</button>
          </>
        )}
        {!readOnly && item.status !== 'CONFIRMADO' && item.status !== 'REJEITADO' && !item.supervisorAtivo && <span className="muted-text">Edite para associar um supervisor ativo.</span>}
        {!readOnly && item.status !== 'CONFIRMADO' && item.status !== 'REJEITADO' && !item.funcionarioId && <span className="muted-text">Edite para vincular o funcionário.</span>}
      </div>
    </article>
  )
}
