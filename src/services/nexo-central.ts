import pb from '@/lib/pocketbase/client'

export type FrenteCentralNexo =
  | 'recomendacoes-dia'
  | 'risco-esfriamento'
  | 'propostas-sem-retorno'
  | 'notas-incompletas'
  | 'followups-atrasados'
  | 'aprendizados-comerciais'

export interface ResponsavelComercialOpcao {
  id: string
  name: string
}

export interface AnaliseCentralNexoRequest {
  frente: FrenteCentralNexo
  responsavel_id?: string
}

export interface AnaliseCentralNexoResponse {
  contrato: 'nexo_central_operacional_v1'
  frente: FrenteCentralNexo
  escopo: {
    tipo: 'proprios' | 'todos' | 'responsavel'
    label: string
    responsavel_id?: string | null
    responsavel_nome?: string | null
    perfil_slug?: string | null
  }
  total_negocios: number
  analise: string
  itens: Array<{
    negocio_id?: string
    external_id?: string | null
    id_negocio?: string | null
    titulo?: string
    cliente?: string | null
    contato?: string | null
    responsavel?: string | null
    detalhamento_proposta?: string
    acao_sugerida?: string
    risco?: string
  }>
  aviso: string
  provider: string
  nexo_provider?: string
  modelo?: string
  agent_display?: string
  model_display?: string
  fallback: boolean
  second_brain?: unknown
}

export async function listarResponsaveisCentralNexo(): Promise<ResponsavelComercialOpcao[]> {
  const res = await pb.send('/backend/v1/usuarios/opcoes-comerciais', { method: 'GET' })
  return Array.isArray(res?.items) ? res.items : []
}

export async function gerarAnaliseCentralNexo(
  payload: AnaliseCentralNexoRequest,
): Promise<AnaliseCentralNexoResponse> {
  return pb.send('/backend/v1/nexo/central/analise', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  })
}
