import type { DashboardIndicador } from './dashboard.api'

const statusIcon: Record<DashboardIndicador['status'], string> = {
  neutro: '•',
  sucesso: '✓',
  alerta: '!',
  perigo: '×',
}

export function IndicadorCard({ indicador }: { indicador: DashboardIndicador }) {
  return (
    <article className={`indicator-card indicator-${indicador.status}`}>
      <div className="indicator-topline">
        <span className="indicator-icon" aria-hidden="true">{statusIcon[indicador.status]}</span>
        <span>{indicador.titulo}</span>
      </div>
      <strong>{indicador.valor.toLocaleString('pt-BR')}</strong>
      <p>{indicador.descricao}</p>
    </article>
  )
}
