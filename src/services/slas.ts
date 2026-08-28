import pb from '@/lib/pocketbase/client'
import type { CommercialContext } from '@/lib/commercial-context'

export type SituacaoSla = 'vencido' | 'alerta' | 'no_prazo' | 'nao_calculavel'
export type FiltroSla = SituacaoSla | 'todas' | 'atencao'
export interface ItemSla {
  negocio: {
    id: string
    external_id: string | null
    titulo: string
    etapa: string
    empresa: { id: string; nome: string } | null
    responsavel: { id: string; nome: string } | null
  }
  contexto?: CommercialContext
  marco_inicial: string | null
  vence_em: string | null
  situacao: SituacaoSla
  motivo_situacao:
    | 'data_entrada_etapa_ausente'
    | 'prazo_etapa_expirado'
    | 'dentro_janela_alerta'
    | 'fora_janela_alerta'
    | 'acao_vencida_fora_tolerancia'
    | 'acao_vencida_dentro_tolerancia'
    | 'acao_para_hoje'
    | 'acao_programada'
    | 'sem_acao_fora_tolerancia'
    | 'sem_acao_dentro_tolerancia'
  dias_uteis: number
  dias_atraso_uteis: number
  proxima_acao_em: string | null
}
export interface FilaSla {
  itens: ItemSla[]
  totais: Record<SituacaoSla, number>
  parametros: { lead: number; proposta: number; negociacao: number; antecedencia: number }
  parametros_controle: Record<ParametroSlaChave, { valor: number; updated: string }>
  calendario: { timezone: string; feriados_ativos: number }
}
export type ParametroSlaChave =
  | 'sla.lead_dias_uteis'
  | 'sla.proposta_dias_uteis'
  | 'sla.negociacao_dias_uteis'
  | 'sla.alerta_antecedencia_dias_uteis'
export const listarSlas = (situacao: FiltroSla = 'todas') =>
  pb.send<FilaSla>('/backend/v1/slas/fila', { method: 'GET', query: { situacao } })

export const atualizarParametroSla = (dados: {
  chave: ParametroSlaChave
  valor: number
  justificativa: string
  updated_esperado: string
}) =>
  pb.send<{ id: string; chave: ParametroSlaChave; valor: string; versao: number; updated: string }>(
    '/backend/v1/slas/parametros',
    {
      method: 'POST',
      body: JSON.stringify(dados),
      headers: { 'Content-Type': 'application/json' },
    },
  )
