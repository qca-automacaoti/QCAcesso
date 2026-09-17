import { useEffect, useState } from 'react'
import { useAuth } from '../auth/auth.context'
import { ChecklistRow } from './ChecklistRow'
import { checklistApi } from './checklist.api'
import type { ChecklistEditInput, ChecklistItem, ChecklistResumo, ChecklistStatus } from './checklist.api'

const filtros: Array<{ label: string; value?: ChecklistStatus }> = [
  { label: 'Todos' },
  { label: 'Pendentes', value: 'PENDENTE' },
  { label: 'Editados', value: 'EDITADO' },
  { label: 'Confirmados', value: 'CONFIRMADO' },
  { label: 'Rejeitados', value: 'REJEITADO' },
]

const resumoInicial: ChecklistResumo = { pendentes: 0, editados: 0, confirmados: 0, rejeitados: 0 }
const PAGE_SIZE = 80

export function ChecklistPage() {
  const [status, setStatus] = useState<ChecklistStatus | undefined>()
  const [itens, setItens] = useState<ChecklistItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [resumo, setResumo] = useState<ChecklistResumo>(resumoInicial)
  const [supervisores, setSupervisores] = useState<Array<{ id: string; nome: string }>>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const { state: authState } = useAuth()
  const readOnly = authState.status !== 'authenticated' || !['ADMIN', 'RH'].includes(authState.usuario.perfil)

  async function carregar(signal?: AbortSignal) {
    setError('')
    setLoading(true)
    try {
      const response = await checklistApi.listar(status, page * PAGE_SIZE, signal)
      const lastPage = Math.max(0, Math.ceil(response.total / PAGE_SIZE) - 1)
      if (page > lastPage) {
        setPage(lastPage)
        return
      }
      setItens(response.itens)
      setTotal(response.total)
      setResumo(response.resumo)
      setSupervisores(response.supervisores)
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o checklist.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    checklistApi.listar(status, page * PAGE_SIZE, controller.signal).then((response) => {
      const lastPage = Math.max(0, Math.ceil(response.total / PAGE_SIZE) - 1)
      if (page > lastPage) {
        setPage(lastPage)
        return
      }
      setItens(response.itens)
      setTotal(response.total)
      setResumo(response.resumo)
      setSupervisores(response.supervisores)
      setError('')
      setLoading(false)
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o checklist.')
        setLoading(false)
      }
    })
    return () => controller.abort()
  }, [status, page])

  async function runAction(id: string, action: () => Promise<void>): Promise<boolean> {
    setBusyId(id)
    setError('')
    try {
      await action()
      await carregar()
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o checklist.')
      return false
    } finally {
      setBusyId('')
    }
  }

  function editar(id: string, input: ChecklistEditInput) {
    return runAction(id, async () => { await checklistApi.editar(id, input) })
  }

  async function confirmar(id: string): Promise<void> {
    await runAction(id, async () => { await checklistApi.confirmar(id) })
  }

  async function rejeitar(id: string): Promise<void> {
    await runAction(id, async () => { await checklistApi.rejeitar(id) })
  }

  return (
    <section className="checklist-page" aria-labelledby="checklist-title">
      <div className="dashboard-heading">
        <div>
          <span className="section-label">REVISÃO</span>
          <h1 id="checklist-title">Checklist de importação</h1>
          <p>Revise os registros importados antes de gerar períodos de férias e controles de acesso.</p>
        </div>
        <button className="button button-secondary" onClick={() => void carregar()} disabled={loading}>
          {loading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>

      <div className="indicator-grid checklist-summary">
        <article className="indicator-card indicator-alerta"><span>Pendentes</span><strong>{resumo.pendentes}</strong><p>Aguardam revisão</p></article>
        <article className="indicator-card indicator-neutro"><span>Editados</span><strong>{resumo.editados}</strong><p>Corrigidos para confirmação</p></article>
        <article className="indicator-card indicator-sucesso"><span>Confirmados</span><strong>{resumo.confirmados}</strong><p>Geraram controle de acesso</p></article>
        <article className="indicator-card indicator-perigo"><span>Rejeitados</span><strong>{resumo.rejeitados}</strong><p>Fora do fluxo operacional</p></article>
      </div>

      <section className="dashboard-panel">
        <div className="checklist-toolbar">
          <div className="filter-tabs" aria-label="Filtro de status">
            {filtros.map((filtro) => (
              <button
                key={filtro.label}
                className={status === filtro.value ? 'filter-tab filter-tab-active' : 'filter-tab'}
                aria-pressed={status === filtro.value}
                onClick={() => {
                  if (status !== filtro.value) {
                    setLoading(true)
                    setPage(0)
                    setStatus(filtro.value)
                  }
                }}
              >
                {filtro.label}
              </button>
            ))}
          </div>
          {loading && <span className="muted-text">Carregando</span>}
        </div>

        {error && <p className="notice notice-error" role="alert">{error}</p>}

        <div className="checklist-list">
          {itens.map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              supervisors={supervisores}
              readOnly={readOnly}
              busy={busyId === item.id}
              onEdit={editar}
              onConfirm={confirmar}
              onReject={rejeitar}
            />
          ))}
          {readOnly && itens.length > 0 && <p className="muted-text">Seu perfil permite consultar os itens. Somente RH e Administração podem revisar ou confirmar.</p>}
          {!loading && itens.length === 0 && <p className="empty-state">Nenhum item encontrado para o filtro selecionado.</p>}
        </div>
        {total > PAGE_SIZE && (
          <div className="checklist-pagination" aria-label="Paginação do checklist">
            <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total} itens</span>
            <div>
              <button className="button button-secondary" onClick={() => { setLoading(true); setPage((current) => Math.max(0, current - 1)) }} disabled={loading || page === 0}>Anterior</button>
              <span>Página {page + 1} de {Math.ceil(total / PAGE_SIZE)}</span>
              <button className="button button-secondary" onClick={() => { setLoading(true); setPage((current) => Math.min(Math.ceil(total / PAGE_SIZE) - 1, current + 1)) }} disabled={loading || page >= Math.ceil(total / PAGE_SIZE) - 1}>Próxima</button>
            </div>
          </div>
        )}
      </section>
    </section>
  )
}
