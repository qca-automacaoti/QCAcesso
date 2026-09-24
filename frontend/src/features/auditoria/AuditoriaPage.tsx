import { useEffect, useState } from 'react'
import { Pagination } from '../../components/Pagination'
import { auditoriaApi } from './auditoria.api'
import type { AuditoriaItem, TipoEvento } from './auditoria.api'

const PAGE_SIZE = 10
const tipos: Array<{ value?: TipoEvento; label: string }> = [
  { label: 'Todos' },
  { value: 'UPLOAD', label: 'Uploads' },
  { value: 'EDICAO_CHECKLIST', label: 'Checklist' },
  { value: 'CONFIRMACAO_BLOQUEIO', label: 'Bloqueios' },
  { value: 'CONFIRMACAO_DESBLOQUEIO', label: 'Desbloqueios' },
  { value: 'ENVIO_ALERTA', label: 'Alertas' },
  { value: 'CONFIGURACAO_ALTERADA', label: 'Configurações' },
]

function dataHora(value: string) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) }
function nomeTipo(tipo: TipoEvento) { return tipos.find((item) => item.value === tipo)?.label ?? tipo }

export function AuditoriaPage() {
  const [tipo, setTipo] = useState<TipoEvento | undefined>()
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [itens, setItens] = useState<AuditoriaItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    auditoriaApi.listar({ tipo, busca: buscaAplicada || undefined, offset: page * PAGE_SIZE }, controller.signal).then((response) => {
      const lastPage = Math.max(0, Math.ceil(response.total / PAGE_SIZE) - 1)
      if (page > lastPage) { setPage(lastPage); return }
      setItens(response.itens)
      setTotal(response.total)
      setError('')
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a auditoria.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [tipo, buscaAplicada, page])

  function buscar(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setPage(0)
    setBuscaAplicada(busca.trim())
  }

  function mudarTipo(value?: TipoEvento) {
    setLoading(true)
    setPage(0)
    setTipo(value)
  }

  return (
    <section className="admin-page" aria-labelledby="audit-title">
      <div className="dashboard-heading"><div><span className="section-label">RASTREABILIDADE</span><h1 id="audit-title">Auditoria</h1><p>Consulte as ações realizadas e os responsáveis por cada evento.</p></div><span className="audit-count">{total} eventos</span></div>
      <section className="dashboard-panel">
        <form className="admin-toolbar" onSubmit={buscar}><label className="admin-search">Buscar na descrição<input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Ex.: funcionário ou ação" /></label><button className="button button-primary" type="submit">Buscar</button></form>
        <div className="filter-tabs" aria-label="Filtrar eventos">{tipos.map((item) => <button key={item.label} className={tipo === item.value ? 'filter-tab filter-tab-active' : 'filter-tab'} onClick={() => mudarTipo(item.value)}>{item.label}</button>)}</div>
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        <div className="audit-list">
          {itens.map((item) => <article className="audit-row" key={item.id}><span className="audit-type">{nomeTipo(item.tipo)}</span><div><strong>{item.descricao}</strong><span>{item.usuario ? `${item.usuario.nome} · ${item.usuario.email}` : 'Rotina automática'}</span></div><time dateTime={item.dataHora}>{dataHora(item.dataHora)}</time></article>)}
          {!loading && itens.length === 0 && <p className="empty-state">Nenhum evento encontrado.</p>}
          {loading && <p className="muted-text" role="status">Carregando auditoria…</p>}
        </div>
        <Pagination page={page} total={total} pageSize={PAGE_SIZE} label="Paginação da auditoria" onPageChange={(nextPage) => { setLoading(true); setPage(nextPage) }} />
      </section>
    </section>
  )
}
