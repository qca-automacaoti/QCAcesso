import { apiRequest } from '../../lib/api-client'

export interface ConfiguracaoEmail { id: string; assunto: string; mensagem: string; atualizadoPor: string | null; atualizadoEm: string }
export const configuracoesApi = {
  obterEmail(signal?: AbortSignal) { return apiRequest<{ item: ConfiguracaoEmail }>('/configuracoes/email', { signal }) },
  salvarEmail(input: { assunto: string; mensagem: string }) { return apiRequest<{ item: ConfiguracaoEmail }>('/configuracoes/email', { method: 'PATCH', body: JSON.stringify(input) }) },
  testarEmail(destinatario: string) { return apiRequest<{ ok: boolean; mensagem: string }>('/configuracoes/email/teste', { method: 'POST', body: JSON.stringify({ destinatario }) }) },
}
