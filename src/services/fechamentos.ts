import pb from '@/lib/pocketbase/client'
import type { CommercialContext } from '@/lib/commercial-context'

export type MotivoPerda =
  | 'preco'
  | 'fechou_com_outra_empresa'
  | 'perdeu_contato'
  | 'desistiu'
  | 'nao_atendido'

const motivoPerdaLabels: Record<MotivoPerda, string> = {
  preco: 'Preço',
  fechou_com_outra_empresa: 'Fechou com outra empresa',
  perdeu_contato: 'Perdeu contato',
  desistiu: 'Desistiu',
  nao_atendido: 'Não atendido',
}

export const motivoPerdaLabel = (value: string | null) =>
  value ? motivoPerdaLabels[value as MotivoPerda] || value : 'Não informado'

export interface ItemFechamento {
  negocio: {
    id: string
    titulo: string
    etapa: string
    resultado: string | null
    fechamento_motivo: MotivoPerda | null
    fechamento_data: string | null
    responsavel_id: string | null
    updated: string
    data_periodo: string | null
  }
  proposta_emitida: boolean
  proposta_aceita: boolean
  proposta_estado: string | null
  elegivel_fechamento: boolean
  contexto: CommercialContext
  tentativas_contato: number
  janela_tentativas_dias_uteis: number
  agenda: null | {
    id: string
    data_alvo: string
    data_acionamento: string
    antecedencia_dias: number
    estado: string
  }
}

export const listarFechamentos = () =>
  pb.send<{ itens: ItemFechamento[] }>('/backend/v1/fechamentos/fila', {
    method: 'GET',
  })

export const decidirFechamento = (body: Record<string, unknown>) =>
  pb.send('/backend/v1/fechamentos/decidir', { method: 'POST', body })

export const reativarFechamento = (body: Record<string, unknown>) =>
  pb.send('/backend/v1/fechamentos/reativar', { method: 'POST', body })

export const novaChaveFechamento = (acao: string, id: string) =>
  `fechamento:${acao}:${id}:${Date.now()}:${crypto.randomUUID()}`
