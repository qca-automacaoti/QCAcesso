/**
 * Apoio ao calendário de férias da TI (calendario.ts)
 * Descrição: Monta a grade mensal e formata datas sempre em UTC, para que uma data
 * no formato AAAA-MM-DD nunca mude de dia por causa do fuso do navegador.
 */

export interface DiaCalendario {
  iso: string
  dia: number
  doMes: boolean
  fimDeSemana: boolean
  hoje: boolean
}

const diaEmMs = 86_400_000

/** Hoje no fuso de operação (America/Sao_Paulo), no formato AAAA-MM-DD. */
export function hojeIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

export function mesCorrente(): string {
  return hojeIso().slice(0, 7)
}

export function deslocarMes(mes: string, meses: number): string {
  const [ano, numero] = mes.split('-').map(Number)
  const referencia = new Date(Date.UTC(ano, numero - 1 + meses, 1))
  return referencia.toISOString().slice(0, 7)
}

export function rotuloMes(mes: string): string {
  const [ano, numero] = mes.split('-').map(Number)
  const rotulo = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(ano, numero - 1, 1)))
  return rotulo.charAt(0).toUpperCase() + rotulo.slice(1)
}

export function formatarData(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00.000Z`))
}

export function formatarDataLonga(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00.000Z`))
}

/** Dias de afastamento: data_fim é o dia do retorno ao trabalho, por isso não é contado. */
export function diasDeAfastamento(inicio: string, fim: string): number {
  return Math.max(1, Math.round((Date.parse(`${fim}T00:00:00.000Z`) - Date.parse(`${inicio}T00:00:00.000Z`)) / diaEmMs))
}

export function somarDias(iso: string, dias: number): string {
  return new Date(Date.parse(`${iso}T00:00:00.000Z`) + dias * diaEmMs).toISOString().slice(0, 10)
}

/** Grade de semanas completas (domingo a sábado) que cobre o mês informado. */
export function diasDoCalendario(mes: string): DiaCalendario[] {
  const [ano, numero] = mes.split('-').map(Number)
  const primeiro = new Date(Date.UTC(ano, numero - 1, 1))
  const inicio = new Date(primeiro.getTime() - primeiro.getUTCDay() * diaEmMs)
  const hoje = hojeIso()
  const dias: DiaCalendario[] = []
  for (let indice = 0; indice < 42; indice += 1) {
    const data = new Date(inicio.getTime() + indice * diaEmMs)
    const iso = data.toISOString().slice(0, 10)
    const diaDaSemana = data.getUTCDay()
    dias.push({
      iso,
      dia: data.getUTCDate(),
      doMes: iso.slice(0, 7) === mes,
      fimDeSemana: diaDaSemana === 0 || diaDaSemana === 6,
      hoje: iso === hoje,
    })
    // Encerra na última semana que ainda contém dias do mês.
    if (indice >= 27 && diaDaSemana === 6 && somarDias(iso, 1).slice(0, 7) !== mes) break
  }
  return dias
}

export const nomesDosDias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
