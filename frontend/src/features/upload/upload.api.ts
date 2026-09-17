import { apiFormRequest, apiRequest } from '../../lib/api-client'

export interface UploadErroLinha {
  linha: number
  motivo: string
}

export interface UploadResultado {
  upload: {
    id: string
    nomeArquivo: string
    totalLinhas: number
    linhasProcessadas: number
    linhasComErro: number
    status: 'CONCLUIDO' | 'ERRO'
  }
  erros: UploadErroLinha[]
}

export interface UploadResumo {
  id: string
  nomeArquivo: string
  dataUpload: string
  totalLinhas: number
  linhasProcessadas: number
  linhasComErro: number
  status: string
}

export const uploadApi = {
  listar: (signal?: AbortSignal) => apiRequest<{ uploads: UploadResumo[] }>('/uploads', { signal }),
  importar: (file: File, signal?: AbortSignal) => {
    const formData = new FormData()
    formData.append('arquivo', file)
    return apiFormRequest<UploadResultado>('/uploads', formData, { signal })
  },
}
