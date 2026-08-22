import pb from '@/lib/pocketbase/client'

export interface EntradaPayload {
  titulo: string
  empresa_id: string
  contato_principal_id?: string
  equipe_id?: string
  responsavel_id: string
  captador_id?: string
  origem_canal: string
  modo: 'pendente' | 'pre_qualificada'
  modalidade?: 'pontual' | 'recorrente'
  necessidade?: string
  localizacao?: string
  dimensao_estimada?: string
  prazo_cliente?: string
  proxima_acao?: string
  proxima_acao_em?: string
  descricao?: string
  command_idempotency_key: string
}

export const criarOportunidade = (payload: EntradaPayload) =>
  pb.send<{ negocio_id: string; etapa: string; qualificacao: string; replay: boolean }>(
    '/backend/v1/negocios/entrada',
    {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    },
  )

export const novaChaveEntrada = () => `entrada:${crypto.randomUUID()}`.slice(0, 128)

export const mapEntradaError = (err: unknown) => {
  const e = err as { status?: number; response?: { error?: string } }
  if (e?.response?.error === 'PRE_QUALIFICACAO_INCOMPLETA')
    return 'Preencha todos os campos mínimos da pré-qualificação.'
  if (e?.response?.error === 'CAMPOS_MINIMOS')
    return 'Preencha título, empresa, responsável e origem.'
  if (e?.status === 403) return 'Você não tem permissão para criar esta oportunidade.'
  return 'Não foi possível criar a oportunidade.'
}
