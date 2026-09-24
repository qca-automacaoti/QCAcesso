import { useEffect, useState } from 'react'
import { UploadDropzone } from './UploadDropzone'
import { uploadApi } from './upload.api'
import type { UploadResultado, UploadResumo } from './upload.api'
import { Pagination } from '../../components/Pagination'

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
const PAGE_SIZE = 10

export function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploads, setUploads] = useState<UploadResumo[]>([])
  const [totalUploads, setTotalUploads] = useState(0)
  const [page, setPage] = useState(0)
  const [resultado, setResultado] = useState<UploadResultado | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function carregarUploads(signal?: AbortSignal, offset = page * PAGE_SIZE) {
    setLoading(true)
    try {
      const response = await uploadApi.listar(offset, signal)
      setUploads(response.uploads)
      setTotalUploads(response.total)
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Não foi possível listar uploads.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    // A chamada inicia a sincronização assíncrona do histórico ao montar a página.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregarUploads(controller.signal)
    return () => controller.abort()
    // carregarUploads usa o número da página atual para consultar o histórico.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  async function handleSubmit() {
    if (!file || submitting) return
    setError('')
    setResultado(null)
    setSubmitting(true)
    try {
      const response = await uploadApi.importar(file)
      setResultado(response)
      setFile(null)
      setPage(0)
      await carregarUploads(undefined, 0)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível importar a planilha.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="upload-page" aria-labelledby="upload-title">
      <div className="dashboard-heading">
        <div>
          <span className="section-label">IMPORTAÇÃO</span>
          <h1 id="upload-title">Upload de planilha</h1>
          <p>Importe férias em lote para criar funcionários e itens pendentes no checklist de revisão.</p>
        </div>
      </div>

      <div className="upload-grid">
        <section className="dashboard-panel" aria-labelledby="nova-importacao-title">
          <div className="panel-header">
            <div>
              <h2 id="nova-importacao-title">Nova importação</h2>
              <p>Colunas aceitas: empresa, cadastro, nome, e-mail, início e fim das férias.</p>
            </div>
          </div>
          <UploadDropzone file={file} disabled={submitting} onFileChange={setFile} />
          <div className="upload-actions">
            <button className="button button-primary" disabled={!file || submitting} onClick={handleSubmit}>
              {submitting ? 'Importando…' : 'Importar planilha'}
            </button>
            {file && <button className="button button-secondary" disabled={submitting} onClick={() => setFile(null)}>Remover</button>}
          </div>
          {error && <p className="notice notice-error" role="alert">{error}</p>}
          {resultado && (
            <div className={`upload-result upload-result-${resultado.upload.status.toLowerCase()}`}>
              <strong>{resultado.upload.linhasProcessadas} de {resultado.upload.totalLinhas} linha(s) processada(s)</strong>
              <span>{resultado.upload.linhasComErro} erro(s) encontrados</span>
            </div>
          )}
        </section>

        <section className="dashboard-panel" aria-labelledby="regras-title">
          <div className="panel-header">
            <div>
              <h2 id="regras-title">Regras da importação</h2>
              <p>A validação acontece antes da criação do checklist.</p>
            </div>
          </div>
          <dl className="metric-list upload-rules">
            <div><dt>Formatos</dt><dd>.xlsx, .xls, .csv</dd></div>
            <div><dt>Tamanho máximo</dt><dd>5 MB</dd></div>
            <div><dt>Limite por arquivo</dt><dd>5.000 linhas</dd></div>
            <div><dt>Status inicial</dt><dd>Pendente</dd></div>
          </dl>
        </section>
      </div>

      {resultado?.erros.length ? (
        <section className="dashboard-panel" aria-labelledby="erros-title">
          <div className="panel-header">
            <div>
              <h2 id="erros-title">Erros da última importação</h2>
              <p>Corrija as linhas indicadas e envie o arquivo novamente.</p>
            </div>
          </div>
          <div className="upload-errors">
            {resultado.erros.slice(0, 10).map((erro) => (
              <article key={`${erro.linha}-${erro.motivo}`}>
                <strong>Linha {erro.linha}</strong>
                <span>{erro.motivo}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="dashboard-panel" aria-labelledby="historico-title">
        <div className="panel-header">
          <div>
            <h2 id="historico-title">Histórico recente</h2>
            <p>Últimas importações registradas no sistema.</p>
          </div>
          {loading && <span>Carregando</span>}
        </div>
        {uploads.length > 0 ? (
          <div className="upload-history">
            {uploads.map((upload) => (
              <article key={upload.id}>
                <div>
                  <strong>{upload.nomeArquivo}</strong>
                  <span>{dateTimeFormatter.format(new Date(upload.dataUpload))}</span>
                </div>
                <div>
                  <span>{upload.linhasProcessadas}/{upload.totalLinhas} linhas</span>
                  <strong className={`status-pill status-${upload.status.toLowerCase()}`}>{upload.status}</strong>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="empty-state">Nenhuma importação registrada ainda.</p>}
        <Pagination page={page} total={totalUploads} pageSize={PAGE_SIZE} label="Paginação do histórico de uploads" onPageChange={(nextPage) => { setLoading(true); setPage(nextPage) }} />
      </section>
    </section>
  )
}
