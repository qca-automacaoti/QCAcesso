import { AlertTriangle, CheckCircle2, CircleDot, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { DashboardIndicador } from './dashboard.api'

const statusIcon: Record<DashboardIndicador['status'], LucideIcon> = {
  neutro: CircleDot,
  sucesso: CheckCircle2,
  alerta: AlertTriangle,
  perigo: XCircle,
}

export function IndicadorCard({ indicador }: { indicador: DashboardIndicador }) {
  const Icon = statusIcon[indicador.status]
  return (
    <article className={`indicator-card indicator-${indicador.status}`}>
      <div className="indicator-topline">
        <span className="indicator-icon" aria-hidden="true"><Icon size={16} strokeWidth={1.75} /></span>
        <span>{indicador.titulo}</span>
      </div>
      <strong>{indicador.valor.toLocaleString('pt-BR')}</strong>
      <p>{indicador.descricao}</p>
    </article>
  )
}
