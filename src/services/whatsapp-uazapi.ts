import pb from '@/lib/pocketbase/client'

export type WhatsAppUazapiQualidadeOperador = {
  chave: string
  label: string
  total_mensagens: number
  vinculadas_negocio?: number
  pendentes_ou_sem_vinculo?: number
  ambiguas?: number
  ultima_interacao?: string
}

export type WhatsAppUazapiNegocioRecente = {
  chave: string
  label: string
  total_mensagens: number
  negocio_id?: string
  negocio_label?: string
  empresa?: string
  contato?: string
  operador?: string
  ultima_interacao?: string
}

export type WhatsAppUazapiQualidadeBase = {
  periodo: string
  total_mensagens_lidas: number
  total_vinculos_lidos: number
  mensagens_vinculadas_negocio: number
  vinculos_automaticos_negocio: number
  vinculos_pendentes_ou_sem_negocio: number
  vinculos_sem_contato: number
  vinculos_ambiguos: number
  vinculos_ambiguos_negocio_aberto: number
  midias_ou_audios_pendentes: number
  aproveitamento_nexo_percentual: number
  por_operador: WhatsAppUazapiQualidadeOperador[]
  negocios_com_conversas_recentes: WhatsAppUazapiNegocioRecente[]
  sinais_comerciais_iniciais: Record<string, number>
  leitura: string
}

export type WhatsAppUazapiResumo = {
  ok: boolean
  monitoramento_ok?: boolean
  fontes_indisponiveis?: string[]
  provider: string
  endpoint: string
  secret_configured: boolean
  modo: string
  automatic_send_allowed: boolean
  politica?: {
    sem_automacao_livre: boolean
    audio: string
    midia: string
    nexo: string
  }
  proximas_etapas?: string[]
  counts: {
    eventos_hoje?: number
    mensagens_hoje?: number
    eventos_24h?: number
    mensagens_24h?: number
    midias_pendentes: number
    transcricoes_pendentes?: number
    vinculos_pendentes?: number
    vinculos_ambiguos_negocio_aberto?: number
  }
  qualidade_base?: WhatsAppUazapiQualidadeBase
  ambiguidades_negocios_abertos?: Array<Record<string, unknown>>
  ultimo_webhook?: Record<string, unknown> | null
  ultima_mensagem?: Record<string, unknown> | null
  ultima_midia?: Record<string, unknown> | null
}

export async function obterStatusWhatsAppUazapi(): Promise<WhatsAppUazapiResumo> {
  return pb.send('/backend/v1/integracao/whatsapp/uazapi/status', {
    method: 'GET',
  })
}
