export const ETAPA_OPTIONS = ['prospects', 'producao_proposta', 'negociacao'] as const
export const RESULTADO_OPTIONS = ['ganho', 'perdido', 'desqualificado'] as const

export const ETAPA_LABELS: Record<string, string> = {
  prospects: 'Prospects',
  producao_proposta: 'Produção Proposta',
  negociacao: 'Negociação',
}

export const RESULTADO_LABELS: Record<string, string> = {
  ganho: 'Ganho',
  perdido: 'Perdido',
  desqualificado: 'Desqualificado',
}

export const STATUS_LABELS: Record<string, string> = {
  ...ETAPA_LABELS,
  ...RESULTADO_LABELS,
}

export const NEGOCIO_STATUS_OPTIONS = [...ETAPA_OPTIONS, ...RESULTADO_OPTIONS] as const

export const STATUS_STAGES = [...ETAPA_OPTIONS]
export const STATUS_RESULTS = [...RESULTADO_OPTIONS]

export const ESCOPO_LABELS: Record<string, string> = {
  proprios: 'Próprios',
  equipe: 'Equipe',
  todos: 'Todos',
}

export function getEtapaLabel(etapa: string): string {
  return ETAPA_LABELS[etapa] || etapa
}

export function getResultadoLabel(resultado: string): string {
  return RESULTADO_LABELS[resultado] || resultado
}

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status
}

export function getEscopoLabel(escopo: string): string {
  return ESCOPO_LABELS[escopo] || escopo
}

export function isStatusStage(status: string): boolean {
  return STATUS_STAGES.includes(status as (typeof STATUS_STAGES)[number])
}

export function isStatusResult(status: string): boolean {
  return STATUS_RESULTS.includes(status as (typeof STATUS_RESULTS)[number])
}
