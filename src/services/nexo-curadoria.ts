import pb from '@/lib/pocketbase/client'

export interface NexoCuradoriaEvento {
  id: string
  tipo_evento?: string
  external_id?: string
  negocio_titulo?: string
  empresa_nome?: string
  contato_nome?: string
  acao?: string
  contexto_resumo?: string
  resposta_resumo?: string
  audit_id?: string
  created_at?: string
  created?: string
  human_review_required?: boolean
  segundo_cerebro_usado?: boolean
  fallback?: boolean
}

export interface NexoCuradoriaResumo {
  pendencias: number
  itens: NexoCuradoriaEvento[]
}

const COLLECTION = 'com_nexo_aprendizado_eventos'
const PENDING_FILTER = 'human_review_required = true'

export async function obterResumoCuradoriaNexo(limit = 5): Promise<NexoCuradoriaResumo> {
  const response = await pb.collection(COLLECTION).getList<NexoCuradoriaEvento>(1, limit, {
    filter: PENDING_FILTER,
    sort: '-created_at',
  })

  return {
    pendencias: response.totalItems,
    itens: response.items,
  }
}
