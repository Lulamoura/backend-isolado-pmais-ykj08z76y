import pb from '@/lib/pocketbase/client'

export interface IndicadorVolumeValor {
  quantidade: number
  valor_centavos: number
}

export interface IndicadoresRelatorioEquipe {
  total: IndicadorVolumeValor
  novos_negocios: IndicadorVolumeValor
  ganhos: IndicadorVolumeValor
  perdidos: IndicadorVolumeValor
  abertos: IndicadorVolumeValor
  modalidades: ModalidadeRelatorioEquipe[]
  conversao_global_percentual: number | null
  conversao_qualitativa_valor_percentual: number | null
}

export interface ModalidadeRelatorioEquipe {
  modalidade: string
  modalidade_label: string
  total: IndicadorVolumeValor
  novos_negocios: IndicadorVolumeValor
  ganhos: IndicadorVolumeValor
  perdidos: IndicadorVolumeValor
  abertos: IndicadorVolumeValor
  conversao_global_percentual: number | null
  conversao_qualitativa_valor_percentual: number | null
}

export interface OperadoraRelatorioEquipe {
  operadora: {
    id: string | null
    nome: string
    email: string | null
    ativo_comercial: boolean
  }
  indicadores: IndicadoresRelatorioEquipe
}

export interface RelatorioEquipeComercialResponse {
  contrato: 'nexo_relatorio_equipe_comercial_v1'
  modo: 'somente_leitura'
  periodo: {
    inicio: string | null
    fim: string | null
    data_civil: 'America/Recife'
    campo: 'fechamento_data_para_decisoes__carteira_aberta_no_fim__crm_created_at_para_novos'
    corte_carteira_aberta: string
  }
  escopo: 'proprios' | 'equipe' | 'todos'
  filtros: {
    equipe_id: string | null
    responsavel_id: string | null
  }
  modalidades_oficiais: Array<{ slug: string; label: string }>
  formulas: {
    taxa_conversao_global: string
    taxa_qualitativa_valor: string
  }
  resumo_geral: IndicadoresRelatorioEquipe
  operadoras: OperadoraRelatorioEquipe[]
  avisos: string[]
  html_executivo?: string
}

export interface RelatorioEquipeComercialParams {
  inicio?: string
  fim?: string
  equipe_id?: string
  responsavel_id?: string
  incluir_html?: boolean
}

export async function obterRelatorioEquipeComercial(
  params: RelatorioEquipeComercialParams = {},
): Promise<RelatorioEquipeComercialResponse> {
  const query = new URLSearchParams()
  if (params.inicio) query.set('inicio', params.inicio)
  if (params.fim) query.set('fim', params.fim)
  if (params.equipe_id) query.set('equipe_id', params.equipe_id)
  if (params.responsavel_id) query.set('responsavel_id', params.responsavel_id)
  query.set('incluir_html', params.incluir_html === false ? 'false' : 'true')

  const suffix = query.toString() ? `?${query.toString()}` : ''
  return pb.send(`/backend/v1/nexo/relatorios/equipe-comercial${suffix}`, { method: 'GET' })
}
