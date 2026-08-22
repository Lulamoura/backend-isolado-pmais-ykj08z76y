import pb from '@/lib/pocketbase/client'

export interface ResponsavelOE {
  id: string
  name: string
}

export interface ItemOE {
  negocio: {
    id: string
    titulo: string
    responsavel_id: string | null
    equipe_id: string | null
    updated: string
  }
  estado_operacional: 'aguardando_oe' | 'em_processo_de_entrega'
  oe: null | {
    numero: string
    data_envio: string
    responsavel_envio: ResponsavelOE | null
  }
}

export const listarOrdensExecucao = () =>
  pb.send<{ itens: ItemOE[]; responsaveis_envio: ResponsavelOE[] }>(
    '/backend/v1/ordens-execucao/fila',
    { method: 'GET' },
  )

export const registrarOrdemExecucao = (body: Record<string, unknown>) =>
  pb.send('/backend/v1/ordens-execucao/registrar', { method: 'POST', body })

export const novaChaveOE = (id: string) => `oe:registrar:${id}:${Date.now()}:${crypto.randomUUID()}`
