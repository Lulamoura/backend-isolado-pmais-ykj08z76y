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

export interface NexoCuradoriaResposta {
  pergunta: string
  resposta: string
}

export interface SalvarEntrevistaCuradoriaInput {
  evento: NexoCuradoriaEvento
  perguntas: string[]
  respostas: string[]
}

const COLLECTION = 'com_nexo_aprendizado_eventos'
const ENTREVISTAS_COLLECTION = 'com_nexo_curadoria_entrevistas'
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

export async function salvarEntrevistaCuradoriaNexo({
  evento,
  perguntas,
  respostas,
}: SalvarEntrevistaCuradoriaInput) {
  const usuario = pb.authStore.model
  const respostasEstruturadas: NexoCuradoriaResposta[] = perguntas.map((pergunta, index) => ({
    pergunta,
    resposta: respostas[index]?.trim() || '',
  }))

  return pb.collection(ENTREVISTAS_COLLECTION).create({
    evento_id: evento.id,
    external_id: evento.external_id || '',
    empresa_nome: evento.empresa_nome || '',
    contato_nome: evento.contato_nome || '',
    negocio_titulo: evento.negocio_titulo || '',
    status: 'aguardando_revisao',
    perguntas_json: JSON.stringify(perguntas),
    respostas_json: JSON.stringify(respostasEstruturadas),
    resumo_contexto: evento.contexto_resumo || '',
    usuario_id: usuario?.id || '',
    usuario_nome: usuario?.name || usuario?.email || '',
    created_at: new Date().toISOString(),
  })
}
