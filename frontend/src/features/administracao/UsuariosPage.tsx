import { useEffect, useState } from 'react'
import { useAuth } from '../auth/auth.context'
import { Pagination } from '../../components/Pagination'
import { administracaoApi } from './administracao.api'
import type { PerfilUsuario, UsuarioAdmin } from './administracao.api'

const perfis: Array<{ value: PerfilUsuario; label: string }> = [
  { value: 'ADMIN', label: 'Administrador' }, { value: 'RH', label: 'Recursos Humanos' },
  { value: 'SUPERVISOR', label: 'Supervisor' }, { value: 'AUDITOR', label: 'Auditor' },
]
const PAGE_SIZE = 10
function formatarData(value: string) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value)) }

export function UsuariosPage() {
  const { state } = useAuth()
  const [itens, setItens] = useState<UsuarioAdmin[]>([])
  const [busca, setBusca] = useState('')
  const [aplicada, setAplicada] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [mostrarCadastro, setMostrarCadastro] = useState(false)
  const [novo, setNovo] = useState({ nome: '', email: '', senha: '', perfil: 'SUPERVISOR' as PerfilUsuario })
  const podeEditar = state.status === 'authenticated' && state.usuario.perfil === 'ADMIN'

  async function carregar(signal?: AbortSignal) {
    setLoading(true)
    try {
      const response = await administracaoApi.listar(aplicada, page * PAGE_SIZE, signal)
      const lastPage = Math.max(0, Math.ceil(response.total / PAGE_SIZE) - 1)
      if (page > lastPage) { setPage(lastPage); return }
      setItens(response.itens); setTotal(response.total); setError('')
    }
    catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os usuários.') }
    finally { if (!signal?.aborted) setLoading(false) }
  }
  // O carregamento sincroniza a lista com o filtro aplicado.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { const controller = new AbortController(); void carregar(controller.signal); return () => controller.abort() }, [aplicada, page])

  async function atualizar(item: UsuarioAdmin, perfil: PerfilUsuario, ativo: boolean) {
    setBusy(item.id); setError('')
    try { const response = await administracaoApi.atualizar(item.id, perfil, ativo); setItens((current) => current.map((user) => user.id === item.id ? response.item : user)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o usuário.') }
    finally { setBusy('') }
  }
  async function cadastrar(event: React.FormEvent) {
    event.preventDefault(); setBusy('novo'); setError('')
    try { const response = await administracaoApi.criar(novo); setPage(0); setItens((current) => [...current, response.item].sort((a, b) => a.nome.localeCompare(b.nome))); setNovo({ nome: '', email: '', senha: '', perfil: 'SUPERVISOR' }); setMostrarCadastro(false) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar o usuário.') }
    finally { setBusy('') }
  }

  return <section className="admin-page" aria-labelledby="users-title">
    <div className="dashboard-heading"><div><span className="section-label">ADMINISTRAÇÃO</span><h1 id="users-title">Usuários e perfis</h1><p>Controle quem pode operar, revisar e auditar o QCAcesso.</p></div><div className="heading-actions"><button className="button button-secondary" onClick={() => void carregar()} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</button>{podeEditar && <button className="button button-primary" onClick={() => setMostrarCadastro((value) => !value)}>{mostrarCadastro ? 'Fechar cadastro' : 'Novo usuário'}</button>}</div></div>
    {mostrarCadastro && <section className="dashboard-panel"><form className="user-create-form" onSubmit={cadastrar}><label>Nome<input required minLength={2} maxLength={120} value={novo.nome} onChange={(event) => setNovo({ ...novo, nome: event.target.value })} /></label><label>E-mail<input required type="email" value={novo.email} onChange={(event) => setNovo({ ...novo, email: event.target.value })} /></label><label>Senha inicial<input required minLength={8} type="password" value={novo.senha} onChange={(event) => setNovo({ ...novo, senha: event.target.value })} /></label><label>Perfil<select value={novo.perfil} onChange={(event) => setNovo({ ...novo, perfil: event.target.value as PerfilUsuario })}>{perfis.map((perfil) => <option value={perfil.value} key={perfil.value}>{perfil.label}</option>)}</select></label><button className="button button-primary" disabled={busy === 'novo'}>{busy === 'novo' ? 'Cadastrando…' : 'Cadastrar usuário'}</button></form></section>}
    <section className="dashboard-panel"><form className="admin-toolbar" onSubmit={(event) => { event.preventDefault(); setPage(0); setAplicada(busca.trim()) }}><label className="admin-search">Buscar por nome ou e-mail<input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Digite para buscar" /></label><button className="button button-primary" type="submit">Buscar</button></form>{error && <p className="notice notice-error" role="alert">{error}</p>}<div className="users-list">{itens.map((item) => <article className="user-row" key={item.id}><div className="user-main"><strong>{item.nome}</strong><span>{item.email}</span><small>Cadastro em {formatarData(item.criadoEm)}</small></div><label className="user-control">Perfil<select value={item.perfil} disabled={!podeEditar || busy === item.id} onChange={(event) => void atualizar(item, event.target.value as PerfilUsuario, item.ativo)}>{perfis.map((perfil) => <option value={perfil.value} key={perfil.value}>{perfil.label}</option>)}</select></label><label className="user-active"><input type="checkbox" checked={item.ativo} disabled={!podeEditar || busy === item.id} onChange={(event) => void atualizar(item, item.perfil, event.target.checked)} /> Ativo</label>{busy === item.id && <span className="muted-text">Salvando…</span>}</article>)}{!loading && itens.length === 0 && <p className="empty-state">Nenhum usuário encontrado.</p>}</div><Pagination page={page} total={total} pageSize={PAGE_SIZE} label="Paginação de usuários" onPageChange={(nextPage) => { setLoading(true); setPage(nextPage) }} />{!podeEditar && <p className="muted-text">Seu perfil permite consultar usuários. Somente Administração pode alterar perfis e status.</p>}</section>
  </section>
}
