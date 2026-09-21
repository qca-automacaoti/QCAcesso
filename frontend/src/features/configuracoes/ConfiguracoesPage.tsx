import { useEffect, useState } from 'react'
import { configuracoesApi } from './configuracoes.api'

const variaveis = ['{{nome}}', '{{empresa}}', '{{cadastro}}', '{{dataProgramada}}', '{{dataInicio}}', '{{dataFim}}', '{{tipoAcao}}', '{{tipoAlerta}}', '{{chamada}}', '{{link}}']
const padrao = { assunto: 'QCAcesso | {{tipoAlerta}} - {{nome}}', mensagem: 'Olá,\n\n{{chamada}}\n\nFuncionário: {{nome}}\nEmpresa: {{empresa}}\nCadastro: {{cadastro}}\n\nAcesse o QCAcesso: {{link}}' }

export function ConfiguracoesPage() {
  const [form, setForm] = useState(padrao)
  const [destinatario, setDestinatario] = useState('')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [testando, setTestando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  async function carregar(signal?: AbortSignal) {
    setLoading(true)
    try { const response = await configuracoesApi.obterEmail(signal); setForm({ assunto: response.item.assunto, mensagem: response.item.mensagem }); setErro('') }
    catch (cause) { if (!signal?.aborted) setErro(cause instanceof Error ? cause.message : 'Não foi possível carregar a configuração.') }
    finally { if (!signal?.aborted) setLoading(false) }
  }
  // Carrega o template global ao entrar na tela.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const controller = new AbortController(); void carregar(controller.signal); return () => controller.abort() }, [])
  async function salvar(event: React.FormEvent) {
    event.preventDefault(); setSalvando(true); setMensagem(''); setErro('')
    try { const response = await configuracoesApi.salvarEmail(form); setForm({ assunto: response.item.assunto, mensagem: response.item.mensagem }); setMensagem('Template salvo. Ele será usado nos próximos alertas automáticos.') }
    catch (cause) { setErro(cause instanceof Error ? cause.message : 'Não foi possível salvar o template.') }
    finally { setSalvando(false) }
  }
  async function testar(event: React.FormEvent) {
    event.preventDefault(); setTestando(true); setMensagem(''); setErro('')
    try { const response = await configuracoesApi.testarEmail(destinatario.trim()); setMensagem(response.mensagem) }
    catch (cause) { setErro(cause instanceof Error ? cause.message : 'Não foi possível enviar o teste.') }
    finally { setTestando(false) }
  }
  return <section className="config-page" aria-labelledby="config-title">
    <div className="dashboard-heading"><div><span className="section-label">CONFIGURAÇÕES</span><h1 id="config-title">Mensagens de e-mail</h1><p>Defina o template global usado nos lembretes e escalonamentos do QCAcesso.</p></div><button className="button button-secondary" onClick={() => void carregar()} disabled={loading}>{loading ? 'Carregando…' : 'Atualizar'}</button></div>
    {erro && <p className="notice notice-error" role="alert">{erro}</p>}{mensagem && <p className="notice notice-success" role="status">{mensagem}</p>}
    <div className="config-grid">
      <form className="dashboard-panel config-form" onSubmit={salvar}><div className="panel-header"><div><h2>Template global</h2><p>Use as variáveis abaixo para personalizar assunto e corpo.</p></div></div><label>Assunto<input required minLength={3} maxLength={180} value={form.assunto} onChange={(event) => setForm({ ...form, assunto: event.target.value })} /></label><label>Mensagem<textarea required minLength={10} maxLength={10000} rows={14} value={form.mensagem} onChange={(event) => setForm({ ...form, mensagem: event.target.value })} /></label><button className="button button-primary" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar template'}</button></form>
      <div className="dashboard-column"><aside className="dashboard-panel config-help"><div className="panel-header"><div><h2>Variáveis disponíveis</h2><p>Elas serão substituídas automaticamente no envio.</p></div></div><div className="config-variables">{variaveis.map((variavel) => <code key={variavel}>{variavel}</code>)}</div><p className="config-example">O teste usa dados de exemplo e envia exatamente o assunto e a mensagem renderizados.</p></aside>
      <form className="dashboard-panel config-test" onSubmit={testar}><div className="panel-header"><div><h2>Testar envio</h2><p>Envie uma cópia para confirmar a configuração SMTP.</p></div></div><label>Endereço para teste<input required type="email" value={destinatario} onChange={(event) => setDestinatario(event.target.value)} placeholder="seu.email@empresa.com" /></label><button className="button button-secondary" disabled={testando}>{testando ? 'Enviando…' : 'Enviar e-mail de teste'}</button><p className="muted-text">O envio requer SMTP configurado no backend.</p></form></div>
    </div>
  </section>
}
