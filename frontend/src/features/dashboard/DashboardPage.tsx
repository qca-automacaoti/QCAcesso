import { useEffect, useMemo, useState } from 'react'
import { IndicadorCard } from './IndicadorCard'
import { dashboardApi } from './dashboard.api'
import type { DashboardResumo } from './dashboard.api'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDate(value: string) {
  return dateFormatter.format(new Date(value + 'T00:00:00'))
}

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value))
}

function prazoLabel(dias: number) {
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Amanhã'
  return `Em ${dias} dias`
}

function tipoLabel(tipo: string) {
  return tipo.replaceAll('_', ' ').toLowerCase()
}

export function DashboardPage() {
  const [resumo, setResumo] = useState<DashboardResumo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function carregar(signal?: AbortSignal) {
    setError('')
    setLoading(true)
    try {
      setResumo(await dashboardApi.resumo(signal))
    } catch (cause) {
      if (signal?.aborted) return
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o dashboard.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void carregar(controller.signal)
    return () => controller.abort()
  }, [])

  const revisaoTotal = useMemo(() => {
    if (!resumo) return 0
    return resumo.revisao.pendentes + resumo.revisao.confirmados + resumo.revisao.rejeitados
  }, [resumo])

  if (loading && !resumo) {
    return <section className="dashboard-state" role="status"><span className="spinner" aria-hidden="true" /><p>Carregando indicadores…</p></section>
  }

  if (error && !resumo) {
    return (
      <section className="dashboard-state">
        <h1>Dashboard indisponível</h1>
        <p role="alert">{error}</p>
        <button className="button button-primary" onClick={() => void carregar()}>Tentar novamente</button>
      </section>
    )
  }

  if (!resumo) return null

  return (
    <section className="dashboard-page" aria-labelledby="dashboard-title">
      <div className="dashboard-heading">
        <div>
          <span className="section-label">PAINEL OPERACIONAL</span>
          <h1 id="dashboard-title">Dashboard</h1>
          <p>Visão consolidada dos bloqueios, liberações, férias e revisões em andamento.</p>
        </div>
        <button className="button button-secondary" onClick={() => void carregar()} disabled={loading}>
          {loading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>

      {error && <p className="notice notice-error" role="alert">{error}</p>}

      <div className="indicator-grid">
        {resumo.indicadores.map((indicador) => <IndicadorCard key={indicador.id} indicador={indicador} />)}
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-panel dashboard-panel-wide" aria-labelledby="acoes-title">
          <div className="panel-header">
            <div>
              <h2 id="acoes-title">Próximas ações</h2>
              <p>Bloqueios e desbloqueios programados para os próximos 7 dias.</p>
            </div>
            <span>{resumo.proximasAcoes.length} itens</span>
          </div>
          {resumo.proximasAcoes.length > 0 ? (
            <div className="action-list">
              {resumo.proximasAcoes.map((acao) => (
                <article className="action-row" key={acao.id}>
                  <span className={`action-badge action-${acao.tipo.toLowerCase()}`}>{acao.tipo === 'BLOQUEIO' ? 'Bloqueio' : 'Desbloqueio'}</span>
                  <div>
                    <strong>{acao.funcionario}</strong>
                    <p>{acao.empresa} · Cadastro {acao.cadastro}</p>
                  </div>
                  <div className="action-date">
                    <strong>{prazoLabel(acao.diasParaAcao)}</strong>
                    <span>{formatDate(acao.dataProgramada)}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="empty-state">Nenhuma ação programada para a próxima semana.</p>}
        </section>

        <section className="dashboard-panel" aria-labelledby="ferias-title">
          <div className="panel-header">
            <div>
              <h2 id="ferias-title">Férias</h2>
              <p>Distribuição atual dos colaboradores.</p>
            </div>
          </div>
          <dl className="metric-list">
            <div><dt>Total de funcionários</dt><dd>{resumo.ferias.funcionariosTotal}</dd></div>
            <div><dt>Em férias</dt><dd>{resumo.ferias.emFerias}</dd></div>
            <div><dt>Bloqueados</dt><dd>{resumo.ferias.bloqueados}</dd></div>
            <div><dt>Entram em férias em 7 dias</dt><dd>{resumo.ferias.proximos7Dias}</dd></div>
          </dl>
        </section>

        <section className="dashboard-panel" aria-labelledby="revisao-title">
          <div className="panel-header">
            <div>
              <h2 id="revisao-title">Checklist</h2>
              <p>Status das revisões importadas.</p>
            </div>
            <span>{revisaoTotal} registros</span>
          </div>
          <dl className="metric-list">
            <div><dt>Pendentes</dt><dd>{resumo.revisao.pendentes}</dd></div>
            <div><dt>Confirmados</dt><dd>{resumo.revisao.confirmados}</dd></div>
            <div><dt>Rejeitados</dt><dd>{resumo.revisao.rejeitados}</dd></div>
            <div><dt>Uploads com erro</dt><dd>{resumo.revisao.uploadsComErro}</dd></div>
          </dl>
        </section>

        <section className="dashboard-panel" aria-labelledby="atividade-title">
          <div className="panel-header">
            <div>
              <h2 id="atividade-title">Atividade recente</h2>
              <p>Últimos eventos registrados.</p>
            </div>
          </div>
          {resumo.atividadeRecente.length > 0 ? (
            <div className="timeline">
              {resumo.atividadeRecente.map((evento) => (
                <article key={evento.id}>
                  <strong>{tipoLabel(evento.tipo)}</strong>
                  <p>{evento.descricao}</p>
                  <time dateTime={evento.dataHora}>{formatDateTime(evento.dataHora)}</time>
                </article>
              ))}
            </div>
          ) : <p className="empty-state">Nenhuma atividade registrada ainda.</p>}
        </section>

        <section className="dashboard-panel" aria-labelledby="controle-title">
          <div className="panel-header">
            <div>
              <h2 id="controle-title">Controle</h2>
              <p>Resumo de execução no mês.</p>
            </div>
          </div>
          <dl className="metric-list">
            <div><dt>Confirmados no mês</dt><dd>{resumo.controle.confirmadosMes}</dd></div>
            <div><dt>Alertas enviados hoje</dt><dd>{resumo.alertas.enviadosHoje}</dd></div>
            <div><dt>Falhas de alerta</dt><dd>{resumo.alertas.falhas}</dd></div>
            <div><dt>Gerado em</dt><dd>{formatDateTime(resumo.geradoEm)}</dd></div>
          </dl>
        </section>
      </div>
    </section>
  )
}
