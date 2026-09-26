import pb from '@/lib/pocketbase/client'

export type WhatsAppUazapiResumo = {
  ok: boolean
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
    eventos_24h: number
    mensagens_24h: number
    midias_pendentes: number
    transcricoes_pendentes?: number
    vinculos_pendentes?: number
  }
  ultimo_webhook?: Record<string, unknown> | null
  ultima_mensagem?: Record<string, unknown> | null
  ultima_midia?: Record<string, unknown> | null
}

export async function obterStatusWhatsAppUazapi(): Promise<WhatsAppUazapiResumo> {
  return pb.send('/backend/v1/integracao/whatsapp/uazapi/status', {
    method: 'GET',
  })
}
