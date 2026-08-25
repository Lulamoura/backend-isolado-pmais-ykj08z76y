import pb from '@/lib/pocketbase/client'

export type SituacaoAtividade = 'sem_proxima_acao' | 'vencida' | 'programada'
export type TipoAtividade =
  | 'tentativa_contato'
  | 'reuniao'
  | 'visita'
  | 'envio_proposta'
  | 'acompanhamento_proposta'
  | 'aceite_verbal_pendente'
  | 'decisao_combinada'
  | 'tarefa_interna'
export type CanalAtividade = 'telefone' | 'email' | 'whatsapp' | 'presencial' | 'video'

export interface ItemFilaAtividade {
  negocio: {
    id: string
    external_id: string | null
    titulo: string
    etapa: string
    empresa: { id: string; nome: string } | null
    responsavel: { id: string; nome: string } | null
    updated: string
  }
  situacao: SituacaoAtividade
  proxima_acao: {
    id: string | null
    tipo: TipoAtividade
    descricao: string | null
    canal: CanalAtividade | null
    estado: 'planejada'
    planejada_para: string | null
    responsavel: { id: string; nome: string } | null
    updated: string
    origem: 'aplicativo' | 'activecampaign'
    editavel: boolean
  } | null
}

export interface FilaAtividadesResponse {
  itens: ItemFilaAtividade[]
  pagina: number
  por_pagina: number
  tem_mais: boolean
  total: number
}

export function listarFilaAtividades(situacao: SituacaoAtividade | 'todas' = 'todas') {
  return pb.send<FilaAtividadesResponse>('/backend/v1/atividades/fila', {
    method: 'GET',
    query: { pagina: '1', por_pagina: '100', situacao },
  })
}

export function registrarAtividade(payload: Record<string, unknown>) {
  return pb.send<{ atividade_id: string; negocio_id: string; estado: string; replay: boolean }>(
    '/backend/v1/atividades/registrar',
    {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

export function novaChaveAtividade(id: string) {
  return `atividade:${id}:${crypto.randomUUID()}`.slice(0, 128)
}

export function mapAtividadeError(err: unknown) {
  const e = err as { status?: number; response?: { error?: string } }
  const code = e?.response?.error
  if (e?.status === 403) return 'Você não tem permissão para registrar esta atividade.'
  if (code === 'STALE_WRITE') return 'O registro foi alterado. Atualize a fila e tente novamente.'
  if (code === 'JA_TERMINAL') return 'Esta atividade já foi concluída ou cancelada.'
  if (code === 'CANAL_OBRIGATORIO') return 'Informe o canal utilizado para concluir a atividade.'
  if (code === 'NEGOCIO_FECHADO') return 'Não é possível planejar ação para um negócio encerrado.'
  return 'Não foi possível registrar a atividade. Tente novamente.'
}
