import pb from '@/lib/pocketbase/client'

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
  marco_inicial: string | null
  vence_em: string | null
  situacao: SituacaoSla
  dias_uteis: number
  proxima_acao_em: string | null
}
export interface FilaSla {
  itens: ItemSla[]
  parametros: { lead: number; proposta: number; negociacao: number; antecedencia: number }
  calendario: { timezone: string; feriados_ativos: number }
}
export const listarSlas = (situacao: FiltroSla = 'todas') =>
  pb.send<FilaSla>('/backend/v1/slas/fila', { method: 'GET', query: { situacao } })
