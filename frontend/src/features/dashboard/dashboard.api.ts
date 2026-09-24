import { apiRequest } from '../../lib/api-client'

export interface DashboardIndicador {
  id: string
  titulo: string
  valor: number
  descricao: string
  status: 'neutro' | 'sucesso' | 'alerta' | 'perigo'
}

export interface DashboardAcao {
  id: string
  tipo: 'BLOQUEIO' | 'DESBLOQUEIO'
  status: 'PENDENTE' | 'CONFIRMADO' | 'ATRASADO' | 'CANCELADO'
  dataProgramada: string
  diasParaAcao: number
  funcionario: string
  empresa: string
  cadastro: string
}

export interface DashboardEvento {
  id: string
  tipo: string
  descricao: string
  dataHora: string
}

export interface DashboardResumo {
  geradoEm: string
  indicadores: DashboardIndicador[]
  controle: {
    bloqueiosPendentes: number
    desbloqueiosPendentes: number
    atrasados: number
    confirmadosMes: number
  }
  ferias: {
    funcionariosTotal: number
    emFerias: number
    bloqueados: number
    periodosAtivos: number
    proximos7Dias: number
  }
  revisao: {
    pendentes: number
    confirmados: number
    rejeitados: number
    uploadsComErro: number
  }
  alertas: {
    enviadosHoje: number
    falhas: number
  }
  proximasAcoes: DashboardAcao[]
  proximasAcoesTotal: number
  atividadeRecente: DashboardEvento[]
  atividadeTotal: number
}

export const dashboardApi = {
  resumo: (atividadeOffset = 0, acoesOffset = 0, signal?: AbortSignal) => apiRequest<DashboardResumo>(`/dashboard?atividadeOffset=${atividadeOffset}&acoesOffset=${acoesOffset}`, { signal }),
}
