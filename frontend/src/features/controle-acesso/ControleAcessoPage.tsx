import { useEffect, useState } from 'react'
import { useAuth } from '../auth/auth.context'
import { controleAcessoApi } from './controle-acesso.api'
import type { ControleAcessoItem, ControleAcessoResumo, ControleStatus, ControleTipo } from './controle-acesso.api'

const filtrosStatus: Array<{ label: string; value?: ControleStatus }> = [
  { label: 'Todas' },
  { label: 'Pendentes', value: 'PENDENTE' },
  { label: 'Atrasadas', value: 'ATRASADO' },
  { label: 'Confirmadas', value: 'CONFIRMADO' },
  { label: 'Canceladas', value: 'CANCELADO' },
]
const PAGE_SIZE = 80
const resumoInicial: ControleAcessoResumo = { pendentes: 0, atrasados: 0, confirmados: 0, cancelados: 0 }

function formatarData(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${value}T12:00:00.000Z`))
}

function hojeLocal() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

function rotuloStatus(status: ControleStatus) {
  return { PENDENTE: 'Pendente', ATRASADO: 'Atrasado', CONFIRMADO: 'Confirmado', CANCELADO: 'Cancelado' }[status]
}

function ControleRow({ item, podeConfirmar, ocupado, onConfirmar }: {
  item: ControleAcessoItem
  podeConfirmar: boolean
  ocupado: boolean
  onConfirmar: (item: ControleAcessoItem) => void
}) {
  const futura = item.dataProgramada > hojeLocal()
  const podeExecutar = podeConfirmar && ['PENDENTE', 'ATRASADO'].includes(item.status) && !futura
  const acao = item.tipo === 'BLOQUEIO' ? 'bloqueio' : 'desbloqueio'
  return (
    <article className="access-row">
      <div className="access-person">
        <strong>{item.funcionario.nome}</strong>
        <span>{item.funcionario.empresa} · Cadastro {item.funcionario.cadastro}</span>
      </div>
      <div className="access-type">
        <span className={`action-badge action-${item.tipo.toLowerCase()}`}>{item.tipo === 'BLOQUEIO' ? 'Bloqueio' : 'Desbloqueio'}</span>
        <span>Férias: {formatarData(item.periodoInicio)} a {formatarData(item.periodoFim)}</span>
      </div>
      <div className="access-date">
        <strong>{formatarData(item.dataProgramada)}</strong>
        <span>Data programada</span>
      </div>
      <div className="access-state">
        <span className={`status-pill status-${item.status.toLowerCase()}`}>{rotuloStatus(item.status)}</span>
        {item.supervisorNome && <span>Responsável: {item.supervisorNome}</span>}
        {item.confirmadoEm && <span>Confirmado em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.confirmadoEm))}</span>}
      </div>
      <div className="checklist-actions">
        {podeExecutar && <button className="button button-primary" onClick={() => onConfirmar(item)} disabled={ocupado}>
          {ocupado ? 'Salvando…' : `Confirmar ${acao} efetuado`}
        </button>}
        {podeConfirmar && ['PENDENTE', 'ATRASADO'].includes(item.status) && futura && <span className="muted-text">Disponível na data programada</span>}
      </div>
    </article>
  )
}

export function ControleAcessoPage() {
  const [status, setStatus] = useState<ControleStatus | undefined>()
  const [tipo, setTipo] = useState<ControleTipo | undefined>()
  const [itens, setItens] = useState<ControleAcessoItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [resumo, setResumo] = useState(resumoInicial)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const { state } = useAuth()
  const podeConfirmar = state.status === 'authenticated' && ['ADMIN', 'RH', 'SUPERVISOR'].includes(state.usuario.perfil)

  useEffect(() => {
    const controller = new AbortController()
    controleAcessoApi.listar(status, tipo, page * PAGE_SIZE, controller.signal).then((response) => {
      const lastPage = Math.max(0, Math.ceil(response.total / PAGE_SIZE) - 1)
      if (page > lastPage) {
        setPage(lastPage)
        return
      }
      setItens(response.itens)
      setTotal(response.total)
      setResumo(response.resumo)
      setError('')
      setLoading(false)
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o controle de acesso.')
        setLoading(false)
      }
    })
    return () => controller.abort()
  }, [status, tipo, page])

  async function atualizar() {
    setLoading(true)
    setError('')
    try {
      const response = await controleAcessoApi.listar(status, tipo, page * PAGE_SIZE)
      setItens(response.itens)
      setTotal(response.total)
      setResumo(response.resumo)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o controle de acesso.')
    } finally {
      setLoading(false)
    }
  }

  async function confirmar(item: ControleAcessoItem) {
    setBusyId(item.id)
    setError('')
    try {
      await controleAcessoApi.confirmar(item.id)
      await atualizar()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível confirmar a ação.')
    } finally {
      setBusyId('')
    }
  }

  function mudarStatus(value?: ControleStatus) {
    if (status !== value) { setPage(0); setLoading(true); setStatus(value) }
  }

  function mudarTipo(value?: ControleTipo) {
    if (tipo !== value) { setPage(0); setLoading(true); setTipo(value) }
  }

  return (
    <section className="access-page" aria-labelledby="access-title">
      <div className="dashboard-heading">
        <div>
          <span className="section-label">OPERAÇÃO</span>
          <h1 id="access-title">Controle de acesso</h1>
          <p>Acompanhe as ações programadas para férias e registre quando o bloqueio ou desbloqueio for efetuado.</p>
        </div>
        <button className="button button-secondary" onClick={() => void atualizar()} disabled={loading}>
          {loading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>

      <div className="indicator-grid access-summary">
        <article className="indicator-card indicator-alerta"><span>Pendentes</span><strong>{resumo.pendentes}</strong><p>Ações dentro do prazo</p></article>
        <article className="indicator-card indicator-perigo"><span>Atrasadas</span><strong>{resumo.atrasados}</strong><p>Aguardam execução</p></article>
        <article className="indicator-card indicator-sucesso"><span>Confirmadas</span><strong>{resumo.confirmados}</strong><p>Ações concluídas</p></article>
        <article className="indicator-card indicator-neutro"><span>Canceladas</span><strong>{resumo.cancelados}</strong><p>Fora do fluxo ativo</p></article>
      </div>

      <section className="dashboard-panel">
        <div className="access-toolbar">
          <div className="filter-tabs" aria-label="Filtrar ações por status">
            {filtrosStatus.map((filtro) => <button key={filtro.label}
              className={status === filtro.value ? 'filter-tab filter-tab-active' : 'filter-tab'}
              aria-pressed={status === filtro.value} onClick={() => mudarStatus(filtro.value)}>{filtro.label}</button>)}
          </div>
          <label className="access-type-filter">Tipo de ação
            <select value={tipo ?? ''} onChange={(event) => mudarTipo((event.target.value || undefined) as ControleTipo | undefined)}>
              <option value="">Todas</option>
              <option value="BLOQUEIO">Bloqueio</option>
              <option value="DESBLOQUEIO">Desbloqueio</option>
            </select>
          </label>
        </div>
        {loading && <p className="muted-text" role="status">Carregando ações…</p>}
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        <div className="access-list">
          {itens.map((item) => <ControleRow key={item.id} item={item} podeConfirmar={podeConfirmar} ocupado={busyId === item.id} onConfirmar={(target) => void confirmar(target)} />)}
          {!loading && itens.length === 0 && <p className="empty-state">Nenhuma ação encontrada para os filtros selecionados.</p>}
        </div>
        {!podeConfirmar && itens.length > 0 && <p className="muted-text">Seu perfil permite consultar as ações, mas não confirmá-las.</p>}
        <p className="access-guidance">Confirme somente depois de concluir a alteração de acesso no sistema responsável. A confirmação atualiza a situação do funcionário e registra a ação no histórico.</p>
        {total > PAGE_SIZE && <div className="checklist-pagination" aria-label="Paginação do controle de acesso">
          <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total} ações</span>
          <div>
            <button className="button button-secondary" onClick={() => { setLoading(true); setPage((value) => Math.max(0, value - 1)) }} disabled={loading || page === 0}>Anterior</button>
            <span>Página {page + 1} de {Math.ceil(total / PAGE_SIZE)}</span>
            <button className="button button-secondary" onClick={() => { setLoading(true); setPage((value) => Math.min(Math.ceil(total / PAGE_SIZE) - 1, value + 1)) }} disabled={loading || page >= Math.ceil(total / PAGE_SIZE) - 1}>Próxima</button>
          </div>
        </div>}
      </section>
    </section>
  )
}
