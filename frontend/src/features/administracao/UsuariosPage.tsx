import { useEffect, useState } from 'react'
import { useAuth } from '../auth/auth.context'
import { administracaoApi } from './administracao.api'
import type { PerfilUsuario, UsuarioAdmin } from './administracao.api'

const perfis: Array<{ value: PerfilUsuario; label: string }> = [
  { value: 'ADMIN', label: 'Administrador' }, { value: 'RH', label: 'Recursos Humanos' }, { value: 'SUPERVISOR', label: 'Supervisor' }, { value: 'AUDITOR', label: 'Auditor' },
]
function formatarData(value: string) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value)) }

export function UsuariosPage() {
  const { state } = useAuth(); const [itens, setItens] = useState<UsuarioAdmin[]>([]); const [busca, setBusca] = useState(''); const [aplicada, setAplicada] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState('')
  const podeEditar = state.status === 'authenticated' && state.usuario.perfil === 'ADMIN'
  async function carregar(signal?: AbortSignal) { setLoading(true); try { const response = await administracaoApi.listar(aplicada, 0, signal); setItens(response.itens); setError('') } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os usuários.') } finally { if (!signal?.aborted) setLoading(false) } }
  // O carregamento sincroniza a lista com o filtro aplicado; o estado de loading é atualizado pelo ciclo assíncrono.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { const controller = new AbortController(); void carregar(controller.signal); return () => controller.abort() }, [aplicada])
  async function atualizar(item: UsuarioAdmin, perfil: PerfilUsuario, ativo: boolean) { setBusy(item.id); setError(''); try { const response = await administracaoApi.atualizar(item.id, perfil, ativo); setItens((current) => current.map((user) => user.id === item.id ? response.item : user)) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o usuário.') } finally { setBusy('') } }
  return <section className="admin-page" aria-labelledby="users-title">
    <div className="dashboard-heading"><div><span className="section-label">ADMINISTRAÇÃO</span><h1 id="users-title">Usuários e perfis</h1><p>Controle quem pode operar, revisar e auditar o QCAcesso.</p></div><button className="button button-secondary" onClick={() => void carregar()} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</button></div>
    <section className="dashboard-panel"><form className="admin-toolbar" onSubmit={(event) => { event.preventDefault(); setAplicada(busca.trim()) }}><label className="admin-search">Buscar por nome ou e-mail<input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Digite para buscar" /></label><button className="button button-primary" type="submit">Buscar</button></form>{error && <p className="notice notice-error" role="alert">{error}</p>}<div className="users-list">{itens.map((item) => <article className="user-row" key={item.id}><div className="user-main"><strong>{item.nome}</strong><span>{item.email}</span><small>Cadastro em {formatarData(item.criadoEm)}</small></div><label className="user-control">Perfil<select value={item.perfil} disabled={!podeEditar || busy === item.id} onChange={(event) => void atualizar(item, event.target.value as PerfilUsuario, item.ativo)}>{perfis.map((perfil) => <option value={perfil.value} key={perfil.value}>{perfil.label}</option>)}</select></label><label className="user-active"><input type="checkbox" checked={item.ativo} disabled={!podeEditar || busy === item.id} onChange={(event) => void atualizar(item, item.perfil, event.target.checked)} /> Ativo</label>{busy === item.id && <span className="muted-text">Salvando…</span>}</article>)}{!loading && itens.length === 0 && <p className="empty-state">Nenhum usuário encontrado.</p>}</div>{!podeEditar && <p className="muted-text">Seu perfil permite consultar usuários. Somente Administração pode alterar perfis e status.</p>}</section>
  </section>
}
