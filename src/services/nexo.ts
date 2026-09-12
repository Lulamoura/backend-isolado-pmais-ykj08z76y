import pb from '@/lib/pocketbase/client'

export interface NexoContextoNegocio {
  contrato: 'nexo_contexto_negocio_v1' | string
  external_id: string
  fontes: {
    negocio_local?: boolean
    activecampaign_deal?: boolean
    activecampaign_campos?: boolean
    activecampaign_notas?: boolean
    proposta_aplicativo?: boolean
  }
  negocio?: {
    id?: string
    titulo?: string
    etapa?: string
    fase_crm?: string | null
    qualificacao?: string | null
    descricao_negocio?: string | null
    fonte_prospeccao?: string | null
    modalidade?: string | null
    valor_centavos?: number | null
    proxima_acao_em?: string | null
  }
  empresa?: {
    id?: string
    nome?: string | null
    email?: string | null
    telefone?: string | null
  } | null
  contato?: {
    id?: string
    nome?: string | null
    email?: string | null
    telefone?: string | null
  } | null
  responsavel?: {
    id?: string
    nome?: string | null
    name?: string | null
    email?: string | null
  } | null
  campos_crm?: {
    descricao_negocio?: string | null
    tipo_servico?: string | null
    detalhamento_proposta?: string | null
  }
  proposta?: null | {
    id?: string
    identificador?: string | null
    status?: string | null
    publicacao_estado?: string | null
    total_acessos?: number | null
    total_downloads?: number | null
    versao_publicada_id?: string | null
    versao_mais_recente?: {
      id?: string
      numero?: number | null
      estado?: string | null
      arquivo_pdf?: string | null
      arquivo_sha256?: string | null
      arquivo_bytes?: number | null
      valor_total_centavos?: number | null
      updated?: string | null
    } | null
  }
  notas_followups?: Array<{
    id?: string
    texto?: string | null
    conteudo?: string | null
    note?: string | null
    created?: string | null
    updated?: string | null
    data?: string | null
  }>
}

export type NexoAcaoAssistida =
  | 'proximo_follow_up'
  | 'preparar_whatsapp'
  | 'email_envio_proposta'
  | 'roteiro_ligacao'
  | 'avaliar_risco_perda'
  | 'melhorar_notas'

export interface NexoAjudaComercial {
  contrato: 'nexo_ajuda_comercial_v1' | string
  external_id: string
  acao: NexoAcaoAssistida
  diagnostico: string
  perguntas_criticas: string[]
  riscos: string[]
  proximos_passos: string[]
  mensagem_sugerida: string
  dicas_para_melhorar_notas: string[]
  resposta_curta?: string
  aviso: string
  modelo?: string
  fallback?: boolean
}

export function obterContextoNexoNegocio(externalId: string) {
  return pb.send<NexoContextoNegocio>(`/backend/v1/nexo/negocios/${externalId}/contexto`, {
    method: 'GET',
  })
}

export function gerarAjudaNexoNegocio(
  externalId: string,
  acao: NexoAcaoAssistida,
  contexto: NexoContextoNegocio,
  instrucaoOperador?: string,
) {
  return pb.send<NexoAjudaComercial>(`/backend/v1/nexo/negocios/${externalId}/ajuda`, {
    method: 'POST',
    body: {
      acao,
      contexto,
      instrucao_operador: instrucaoOperador || '',
    },
  })
}
