import pb from '@/lib/pocketbase/client'

export type SituacaoSla = 'vencido' | 'alerta' | 'no_prazo'
export interface ItemSla {
  negocio: { id: string; titulo: string; etapa: string; updated: string }
  vence_em: string
  situacao: SituacaoSla
  dias_uteis: number
  proxima_acao_em: string | null
}
export interface FilaSla {
  itens: ItemSla[]
  parametros: { lead: number; proposta: number; negociacao: number; antecedencia: number }
  calendario: { timezone: string; feriados_ativos: number }
}
export const listarSlas = () => pb.send<FilaSla>('/backend/v1/slas/fila', { method: 'GET' })
