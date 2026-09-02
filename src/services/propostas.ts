import pb from '@/lib/pocketbase/client'
import type { CommercialContext } from '@/lib/commercial-context'

export type EventoProposta = 'preparar' | 'aprovar' | 'emitir' | 'visualizar' | 'decidir'
export interface ItemProposta {
  negocio: {
    id: string
    titulo: string
    etapa: string
    updated: string
    data_periodo: string | null
  }
  contexto: CommercialContext
  proposta: null | {
    id: string
    identificador: string
    versao_id: string
    numero: number
    estado: 'rascunho' | 'enviada' | 'aceita' | 'recusada' | 'cancelada'
    modalidade: 'recorrente' | 'evento' | 'serv_eventual'
    valor_total_centavos: number
    valor_mensal_centavos: number
    destinatario: string | null
    canal_envio: string | null
    updated: string
    aprovada: boolean
    visualizada: boolean
    eventos: Array<{
      id: string
      tipo: string
      autor_id: string
      data_hora: string
    }>
  }
}
export const listarPropostas = () =>
  pb.send<{ itens: ItemProposta[] }>('/backend/v1/propostas/fila', {
    method: 'GET',
  })
export const registrarEventoProposta = (body: Record<string, unknown>) =>
  pb.send('/backend/v1/propostas/eventos', { method: 'POST', body })
export interface VersaoPropostaInterna {
  id: string
  numero: number
  estado: string
  arquivo_nome: string | null
  arquivo_sha256: string | null
  arquivo_bytes: number
  aprovacao_estado: string | null
  created: string
  updated: string
  eventos: Array<{
    id: string
    tipo: string
    autor_id: string
    data_hora: string
    justificativa: string | null
  }>
}
export const criarVersaoPdfProposta = (
  negocioId: string,
  updatedEsperado: string,
  arquivo: File,
) => {
  const body = new FormData()
  body.append('arquivo_pdf', arquivo)
  body.append('updated_esperado', updatedEsperado)
  body.append('command_idempotency_key', novaChaveProposta(negocioId, 'versao-pdf'))
  return pb.send(`/backend/v1/propostas/${negocioId}/versoes`, { method: 'POST', body })
}
export const obterTimelineProposta = (negocioId: string) =>
  pb.send<{ proposta_id: string; versoes: VersaoPropostaInterna[] }>(
    `/backend/v1/propostas/${negocioId}/timeline`,
    { method: 'GET' },
  )
export const novaChaveProposta = (id: string, tipo: string) =>
  `proposta:${tipo}:${id}:${Date.now()}:${crypto.randomUUID()}`
