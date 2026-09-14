const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(baseUrl + path, {
      ...options,
      credentials: 'include',
      cache: 'no-store',
      signal: options.signal || AbortSignal.timeout(30_000),
      headers: { 'Content-Type': 'application/json', 'X-QCA-Request': '1', ...options.headers },
    })
  } catch {
    throw new ApiError(0, 'SEM_CONEXAO', 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.')
  }
  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => null)
  // 502/504 sem corpo JSON: o proxy do Vite não alcançou a API (backend parado ou fora da porta).
  if ([502, 504].includes(response.status) && !body?.error) {
    throw new ApiError(response.status, 'API_INDISPONIVEL', 'O servidor da API não está respondendo. Verifique se o backend está em execução.')
  }
  if (!response.ok) {
    throw new ApiError(response.status, body?.error?.code || 'ERRO_API', body?.error?.message || 'Não foi possível concluir a solicitação.')
  }
  if (!body) throw new ApiError(502, 'RESPOSTA_INVALIDA', 'O servidor retornou uma resposta inválida.')
  return body as T
}
