import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck, ChevronLeft, ChevronRight, Plane, Users } from 'lucide-react'
import { useAuth } from '../auth/auth.context'
import { tecnologiaApi } from './tecnologia.api'
import type { CalendarioTi, NovoPeriodoTi, PeriodoFeriasTi } from './tecnologia.api'
import {
  deslocarMes, diasDeAfastamento, diasDoCalendario, formatarData, formatarDataLonga,
  hojeIso, mesCorrente, nomesDosDias, rotuloMes, somarDias,
} from './calendario'

const CORES = 8
const calendarioVazio: CalendarioTi = { mes: mesCorrente(), inicio: '', fim: '', colaboradores: [], supervisores: [], periodos: [], podeCadastrar: false }

/** Cor estável por colaborador: o mesmo integrante mantém a cor em qualquer mês. */
function corDoColaborador(chave: string) {
  let hash = 0
  for (let indice = 0; indice < chave.length; indice += 1) hash = (hash * 31 + chave.charCodeAt(indice)) % 9973
  return hash % CORES
}

function nomeCurto(nome: string) {
  const partes = nome.trim().split(/\s+/)
  return partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1][0]}.` : partes[0]
}

const statusLabels: Record<PeriodoFeriasTi['status'], string> = { CONFIRMADO: 'Confirmado', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' }

export function TecnologiaPage() {
  const { state } = useAuth()
  const [mes, setMes] = useState(mesCorrente())
  const [dados, setDados] = useState<CalendarioTi>(calendarioVazio)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [busy, setBusy] = useState('')
  const [mostrarCadastro, setMostrarCadastro] = useState(false)
  const [form, setForm] = useState<NovoPeriodoTi>({ colaboradorId: '', dataInicio: '', dataFim: '', supervisorId: '' })

  const usuario = state.status === 'authenticated' ? state.usuario : undefined
  const podeCadastrar = dados.podeCadastrar

  async function carregar(mesAlvo: string, signal?: AbortSignal) {
    setLoading(true)
    try {
      const resposta = await tecnologiaApi.calendario(mesAlvo, signal)
      setDados(resposta)
      setError('')
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o calendário da TI.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  // O carregamento sincroniza o calendário com o mês selecionado.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const controller = new AbortController(); void carregar(mes, controller.signal); return () => controller.abort() }, [mes])

  // Supervisão responde por padrão pelas próprias ações de acesso.
  const supervisorPadrao = usuario?.perfil === 'SUPERVISOR' && dados.supervisores.some((item) => item.id === usuario.id) ? usuario.id : ''
  const supervisorSelecionado = form.supervisorId || supervisorPadrao

  const dias = useMemo(() => diasDoCalendario(mes), [mes])
  const semanas = useMemo(() => Array.from({ length: Math.ceil(dias.length / 7) }, (_, indice) => dias.slice(indice * 7, indice * 7 + 7)), [dias])
  const ativos = useMemo(() => dados.periodos.filter((periodo) => periodo.status !== 'CANCELADO'), [dados.periodos])
  const legenda = useMemo(() => {
    const mapa = new Map<string, { chave: string; nome: string }>()
    for (const periodo of ativos) {
      const chave = periodo.colaboradorId ?? periodo.colaboradorNome
      if (!mapa.has(chave)) mapa.set(chave, { chave, nome: periodo.colaboradorNome })
    }
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [ativos])

  function periodosDoDia(iso: string) {
    return ativos.flatMap((periodo) => {
      const afastado = iso >= periodo.dataInicio && iso < periodo.dataFim
      const retorno = iso === periodo.dataFim
      if (!afastado && !retorno) return []
      return [{ periodo, retorno, primeiroDia: iso === periodo.dataInicio, ultimoDia: iso === somarDias(periodo.dataFim, -1) }]
    })
  }

  async function cadastrar(evento: React.FormEvent) {
    evento.preventDefault()
    setBusy('novo'); setError(''); setAviso('')
    try {
      const { item } = await tecnologiaApi.cadastrar({ ...form, supervisorId: supervisorSelecionado })
      setAviso(`Férias de ${item.colaboradorNome} registradas de ${formatarData(item.dataInicio)} até o retorno em ${formatarData(item.dataFim)}. Bloqueio e desbloqueio agendados.`)
      setForm({ colaboradorId: '', dataInicio: '', dataFim: '', supervisorId: form.supervisorId })
      setMostrarCadastro(false)
      const mesDoPeriodo = item.dataInicio.slice(0, 7)
      if (mesDoPeriodo !== mes) setMes(mesDoPeriodo)
      else await carregar(mes)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar as férias.')
    } finally {
      setBusy('')
    }
  }

  async function cancelar(periodo: PeriodoFeriasTi) {
    if (!window.confirm(`Cancelar as férias de ${periodo.colaboradorNome} (${formatarData(periodo.dataInicio)} a ${formatarData(periodo.dataFim)})?`)) return
    setBusy(periodo.id); setError(''); setAviso('')
    try {
      await tecnologiaApi.cancelar(periodo.id)
      setAviso(`Férias de ${periodo.colaboradorNome} canceladas. As ações de acesso pendentes também foram canceladas.`)
      await carregar(mes)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cancelar o período.')
    } finally {
      setBusy('')
    }
  }

  const hoje = hojeIso()
  const deFeriasHoje = ativos.filter((periodo) => hoje >= periodo.dataInicio && hoje < periodo.dataFim).length

  return <section className="ti-page" aria-labelledby="ti-title">
    <div className="dashboard-heading">
      <div>
        <span className="section-label">TECNOLOGIA</span>
        <h1 id="ti-title">Férias da equipe de TI</h1>
        <p>Calendário mensal com o período de afastamento de cada integrante da Tecnologia, do primeiro dia de férias até o retorno.</p>
      </div>
      <div className="heading-actions">
        <button className="button button-secondary" onClick={() => void carregar(mes)} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</button>
        {podeCadastrar && <button className="button button-primary" onClick={() => { setMostrarCadastro((valor) => !valor); setAviso('') }}>{mostrarCadastro ? 'Fechar cadastro' : 'Cadastrar férias'}</button>}
      </div>
    </div>

    <div className="indicator-grid ti-summary">
      <article className="indicator-card indicator-neutro">
        <div className="indicator-topline">
          <span className="indicator-icon" aria-hidden="true"><Users size={16} strokeWidth={1.75} /></span>
          <span>Equipe de TI</span>
        </div>
        <strong>{dados.colaboradores.length}</strong>
        <p>Colaboradores com perfil Tecnologia</p>
      </article>
      <article className="indicator-card indicator-alerta">
        <div className="indicator-topline">
          <span className="indicator-icon" aria-hidden="true"><Plane size={16} strokeWidth={1.75} /></span>
          <span>De férias hoje</span>
        </div>
        <strong>{deFeriasHoje}</strong>
        <p>Integrantes afastados nesta data</p>
      </article>
      <article className="indicator-card indicator-sucesso">
        <div className="indicator-topline">
          <span className="indicator-icon" aria-hidden="true"><CalendarCheck size={16} strokeWidth={1.75} /></span>
          <span>Períodos no mês</span>
        </div>
        <strong>{ativos.length}</strong>
        <p>Férias que passam por {rotuloMes(mes).toLowerCase()}</p>
      </article>
    </div>

    {error && <p className="notice notice-error" role="alert">{error}</p>}
    {aviso && <p className="notice notice-success" role="status">{aviso}</p>}

    {mostrarCadastro && podeCadastrar && <section className="dashboard-panel">
      <div className="panel-header">
        <div>
          <h2>Cadastrar férias de TI</h2>
          <p>O cadastro agenda automaticamente o bloqueio no afastamento e o desbloqueio no retorno.</p>
        </div>
      </div>
      <form className="ti-form" onSubmit={cadastrar}>
        <label>Colaborador de TI
          <select required value={form.colaboradorId} onChange={(evento) => setForm({ ...form, colaboradorId: evento.target.value })}>
            <option value="">Selecione</option>
            {dados.colaboradores.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
          </select>
        </label>
        <label>Afastamento
          <input required type="date" value={form.dataInicio} onChange={(evento) => setForm({ ...form, dataInicio: evento.target.value })} />
        </label>
        <label>Retorno
          <input required type="date" min={form.dataInicio ? somarDias(form.dataInicio, 1) : undefined} value={form.dataFim} onChange={(evento) => setForm({ ...form, dataFim: evento.target.value })} />
        </label>
        <label>Supervisor responsável
          <select required value={supervisorSelecionado} onChange={(evento) => setForm({ ...form, supervisorId: evento.target.value })}>
            <option value="">Selecione</option>
            {dados.supervisores.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
          </select>
        </label>
        <button className="button button-primary" disabled={busy === 'novo'}>{busy === 'novo' ? 'Cadastrando…' : 'Cadastrar'}</button>
      </form>
      {dados.colaboradores.length === 0 && <p className="muted-text">Nenhum colaborador com perfil Tecnologia está ativo. Cadastre o usuário em Usuários e selecione o perfil Tecnologia.</p>}
      {dados.supervisores.length === 0 && <p className="muted-text">Nenhum supervisor ativo disponível para responder pelas ações de bloqueio e desbloqueio.</p>}
      <p className="access-guidance">O retorno é o primeiro dia de trabalho após as férias: é a data em que o acesso é liberado novamente.</p>
    </section>}

    <section className="dashboard-panel">
      <div className="ti-calendar-toolbar">
        <div className="ti-month-nav">
          <button className="button button-secondary" onClick={() => setMes(deslocarMes(mes, -1))} aria-label="Mês anterior"><ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" /></button>
          <strong aria-live="polite">{rotuloMes(mes)}</strong>
          <button className="button button-secondary" onClick={() => setMes(deslocarMes(mes, 1))} aria-label="Mês seguinte"><ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" /></button>
        </div>
        <div className="ti-toolbar-side">
          {mes !== mesCorrente() && <button className="button button-ghost" onClick={() => setMes(mesCorrente())}>Voltar para o mês atual</button>}
          <span className="audit-count">{ativos.length} {ativos.length === 1 ? 'período' : 'períodos'}</span>
        </div>
      </div>

      <div className="ti-calendar-wrap">
      <table className="ti-calendar">
        <caption className="sr-only">Férias da equipe de TI em {rotuloMes(mes)}</caption>
        <thead>
          <tr>{nomesDosDias.map((nome) => <th key={nome} scope="col">{nome}</th>)}</tr>
        </thead>
        <tbody>
          {semanas.map((semana) => <tr key={semana[0].iso}>
            {semana.map((dia) => {
              const marcas = dia.doMes ? periodosDoDia(dia.iso) : []
              const classes = ['ti-day']
              if (!dia.doMes) classes.push('ti-day-fora')
              if (dia.fimDeSemana) classes.push('ti-day-fds')
              if (dia.hoje) classes.push('ti-day-hoje')
              return <td key={dia.iso} className={classes.join(' ')}>
                <span className="ti-day-number">{dia.dia}</span>
                {marcas.length > 0 && <div className="ti-day-marks">
                  {marcas.map(({ periodo, retorno, primeiroDia, ultimoDia }) => {
                    const chave = periodo.colaboradorId ?? periodo.colaboradorNome
                    const modificadores = [`ti-chip ti-cor-${corDoColaborador(chave)}`]
                    if (retorno) modificadores.push('ti-chip-retorno')
                    if (primeiroDia) modificadores.push('ti-chip-inicio')
                    if (ultimoDia) modificadores.push('ti-chip-fim')
                    const descricao = retorno
                      ? `${periodo.colaboradorNome} retorna em ${formatarDataLonga(periodo.dataFim)}`
                      : `${periodo.colaboradorNome} de férias de ${formatarData(periodo.dataInicio)} até o retorno em ${formatarData(periodo.dataFim)}`
                    return <span key={`${periodo.id}-${dia.iso}`} className={modificadores.join(' ')} title={descricao}>
                      <span className="sr-only">{descricao}</span>
                      <span aria-hidden="true">{retorno ? `↩ ${nomeCurto(periodo.colaboradorNome)}` : nomeCurto(periodo.colaboradorNome)}</span>
                    </span>
                  })}
                </div>}
              </td>
            })}
          </tr>)}
        </tbody>
      </table>
      </div>

      {legenda.length > 0 && <ul className="ti-legend">
        {legenda.map((item) => <li key={item.chave}><span className={`ti-dot ti-cor-${corDoColaborador(item.chave)}`} aria-hidden="true" />{item.nome}</li>)}
        <li className="ti-legend-note"><span className="ti-dot ti-dot-retorno" aria-hidden="true" />↩ dia do retorno (acesso liberado)</li>
      </ul>}
      {!loading && ativos.length === 0 && <p className="empty-state">Nenhuma férias de TI registrada em {rotuloMes(mes).toLowerCase()}.</p>}
    </section>

    {ativos.length > 0 && <section className="dashboard-panel">
      <div className="panel-header">
        <div>
          <h2>Períodos do mês</h2>
          <p>Do afastamento ao retorno, com o supervisor responsável pelas ações de acesso.</p>
        </div>
      </div>
      <div className="ti-period-list">
        {ativos.map((periodo) => {
          const chave = periodo.colaboradorId ?? periodo.colaboradorNome
          const emAndamento = hoje >= periodo.dataInicio && hoje < periodo.dataFim
          return <article className="ti-period-row" key={periodo.id}>
            <div className="ti-period-person">
              <span className={`ti-dot ti-cor-${corDoColaborador(chave)}`} aria-hidden="true" />
              <div>
                <strong>{periodo.colaboradorNome}</strong>
                <span>{periodo.supervisorNome ? `Supervisor: ${periodo.supervisorNome}` : 'Sem supervisor vinculado'}</span>
              </div>
            </div>
            <div className="ti-period-dates">
              <strong>{formatarData(periodo.dataInicio)} → {formatarData(periodo.dataFim)}</strong>
              <span>{diasDeAfastamento(periodo.dataInicio, periodo.dataFim)} dias de afastamento · retorno em {formatarDataLonga(periodo.dataFim)}</span>
            </div>
            <div className="ti-period-state">
              <span className={`status-pill status-${periodo.status.toLowerCase()}`}>{statusLabels[periodo.status]}</span>
              {emAndamento && <span>Em férias agora</span>}
            </div>
            <div className="checklist-actions">
              {podeCadastrar && periodo.status === 'CONFIRMADO' && <button className="button button-secondary" disabled={busy === periodo.id} onClick={() => void cancelar(periodo)}>{busy === periodo.id ? 'Cancelando…' : 'Cancelar'}</button>}
            </div>
          </article>
        })}
      </div>
      {!podeCadastrar && <p className="muted-text">Seu perfil permite consultar o calendário. Somente Administração e Supervisão podem cadastrar ou cancelar férias da TI.</p>}
    </section>}
  </section>
}
