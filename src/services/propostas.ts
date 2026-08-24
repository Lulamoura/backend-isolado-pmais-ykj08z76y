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
export const novaChaveProposta = (id: string, tipo: string) =>
  `proposta:${tipo}:${id}:${Date.now()}:${crypto.randomUUID()}`
