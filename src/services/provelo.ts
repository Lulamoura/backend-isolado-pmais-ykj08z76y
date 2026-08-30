import pb from '@/lib/pocketbase/client'
export type ProveloStatus = {
  provider: string
  enabled: boolean
  configured: boolean
  fingerprint: string
  updated_at: string | null
  last_success_at: string | null
  last_failure_at: string | null
  last_uncertain_at: string | null
}
export const getProveloStatus = () =>
  pb.send<ProveloStatus>('/backend/v1/integracao/provelo/configuracao', { method: 'GET' })
export const changeProvelo = (body: Record<string, string>) =>
  pb.send<ProveloStatus>('/backend/v1/integracao/provelo/configuracao', { method: 'POST', body })
