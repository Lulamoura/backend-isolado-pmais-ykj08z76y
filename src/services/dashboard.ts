import pb from '@/lib/pocketbase/client'

export interface DashboardResumoParams {
  inicio?: string
  fim?: string
  equipe_id?: string
  responsavel_id?: string
  modalidade?: 'recorrente' | 'evento' | 'serv_eventual'
  situacao?: 'negociacao' | 'ganhos' | 'perdidos' | 'aguardando_oe'
  incluir_inativos?: boolean
}

export interface DashboardResumo {
  total: number
  situacao: {
    abertos: number
    ganhos: number
    perdidos: number
    desqualificados: number
  }
  qualificacao: {
    pendentes: number
    qualificadas: number
    desqualificadas: number
  }
  valores: {
    total_precificado_centavos: number
    carteira_aberta_centavos: number
    ganho_centavos: number
    perdido_centavos: number
    negocios_precificados: number
    negocios_valor_zero: number
    negocios_marcador_um_centavo: number
    ticket_medio_precificado_centavos: number | null
    ticket_medio_ganho_centavos: number | null
  }
  conversoes: {
    global_percentual: number | null
    qualitativa_percentual: number | null
    decisoes_valor_centavos: number
    qualificacao_percentual: number | null
    propostas_percentual: number | null
    propostas_status: string
  }
  cobertura: {
    origem: DashboardCobertura
    responsavel: DashboardCobertura
    modalidade: DashboardCobertura & { status: string }
  }
  perdas_por_motivo: Array<{ motivo: string; quantidade: number; valor_centavos: number }>
  modalidades: Array<{ modalidade: string; quantidade: number; valor_centavos: number }>
  ganhos_por_modalidade: Array<{
    modalidade: string
    quantidade: number
    valor_centavos: number
  }>
  fontes_prospeccao: Array<{ fonte: string; quantidade: number }>
  responsaveis: Array<{
    responsavel_id: string | null
    responsavel: string
    quantidade: number
  }>
}

export interface DashboardCobertura {
  preenchidos: number
  total: number
  percentual: number | null
}

export interface DashboardResumoResponse {
  periodo: {
    inicio: string | null
    fim: string | null
    data_civil: 'America/Recife'
    campo: 'created'
  }
  filtros: {
    equipe_id: string | null
    responsavel_id: string | null
    modalidade: string | null
    situacao: string | null
    incluir_inativos: boolean
  }
  escopo: 'proprios' | 'equipe' | 'todos'
  opcoes_filtro: {
    equipes: Array<{ id: string; nome: string }>
    responsaveis: Array<{ id: string; nome: string; ativo: boolean }>
  }
  resumo: DashboardResumo
  avisos: string[]
}

function toQueryParams(params: DashboardResumoParams): Record<string, string> {
  const query: Record<string, string> = {}

  if (params.inicio !== undefined) query.inicio = params.inicio
  if (params.fim !== undefined) query.fim = params.fim
  if (params.equipe_id !== undefined) query.equipe_id = params.equipe_id
  if (params.responsavel_id !== undefined) query.responsavel_id = params.responsavel_id
  if (params.modalidade !== undefined) query.modalidade = params.modalidade
  if (params.situacao !== undefined) query.situacao = params.situacao
  if (params.incluir_inativos !== undefined) {
    query.incluir_inativos = String(params.incluir_inativos)
  }

  return query
}

export async function getDashboardResumo(
  params: DashboardResumoParams = {},
): Promise<DashboardResumoResponse> {
  return pb.send('/backend/v1/dashboard/resumo', {
    method: 'GET',
    query: toQueryParams(params),
  })
}
