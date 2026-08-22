import pb from '@/lib/pocketbase/client'
import { assertMutationsEnabled } from '@/lib/feature-flags'

// ─────────────────────────────────────────────────────────────────────
// Tipos (definidos inline — nunca importar de si mesmo)
// ─────────────────────────────────────────────────────────────────────

export interface CriarSubstituicaoPayload {
  command_idempotency_key: string
  creation_idempotency_key: string
  titular_id: string
  substituto_principal_id: string | null
  substituto_reserva_id: string | null
  data_inicio: string
  data_fim: string
  tipo_cobertura: 'integral' | 'por_negocios'
  negocios_cobertos: string[] | null
  motivo: 'ferias' | 'licenca' | 'falta'
  observacao: string | null
}

export interface AjustarSubstituicaoPayload {
  command_idempotency_key: string
  id: string
  updated_esperado: string
  data_inicio: string
  data_fim: string
  substituto_principal_id?: string | null
  substituto_reserva_id?: string | null
  negocios_cobertos?: string[] | null
  observacao?: string | null
}

export interface CancelarSubstituicaoPayload {
  id: string
  updated_esperado: string
  justificativa_cancelamento: string
  command_idempotency_key: string
}

export interface ConsultaSubstituicoesParams {
  id?: string
  situacao?: 'futura' | 'vigente' | 'encerrada' | 'cancelada'
  titular_id?: string
  substituto_principal_id?: string
  data_inicio_apos?: string
  data_fim_antes?: string
  pagina?: number
  por_pagina?: number
  ordenar_por?: 'data_inicio' | 'data_fim' | 'created'
  ordem?: 'asc' | 'desc'
}

export interface SubstituicaoItem {
  id: string
  data_inicio: string
  data_fim: string
  tipo_cobertura: 'integral' | 'por_negocios'
  motivo: 'ferias' | 'licenca' | 'falta'
  cancelada_em: string | null
  situacao: 'cancelada' | 'futura' | 'vigente' | 'encerrada'
  titular: { id: string; name: string } | null
  substituto_principal: { id: string; name: string } | null
  substituto_reserva: { id: string; name: string } | null
}

export interface ConsultaSubstituicoesResponse {
  substituicoes: SubstituicaoItem[]
  pagina: number
  por_pagina: number
  has_more: boolean
}

export interface SubstituicaoView extends SubstituicaoItem {
  negocios_cobertos: Array<{ id: string; titulo: string }>
  observacao: string | null
  justificativa_cancelamento: string | null
  autor: { id: string; name: string } | null
  created: string
  updated: string
}

export interface BackendError {
  error: string
  message?: string
}

// ─────────────────────────────────────────────────────────────────────
// toQueryParams — omite undefined/null, number→String(n), preserva string
// ─────────────────────────────────────────────────────────────────────

export function toQueryParams(params: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of Object.keys(params)) {
    const value = params[key]
    if (value === undefined || value === null) continue
    if (typeof value === 'number') {
      out[key] = String(value)
    } else if (typeof value === 'string') {
      out[key] = value
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────
// Funções mutantes — gate na primeira linha, antes de qualquer operação
// ─────────────────────────────────────────────────────────────────────

export async function criarSubstituicao(
  payload: CriarSubstituicaoPayload,
): Promise<{ id: string }> {
  assertMutationsEnabled('/backend/v1/substituicoes/criar')
  return pb.send('/backend/v1/substituicoes/criar', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function ajustarSubstituicao(
  payload: AjustarSubstituicaoPayload,
): Promise<{ id: string }> {
  assertMutationsEnabled('/backend/v1/substituicoes/ajustar')
  return pb.send('/backend/v1/substituicoes/ajustar', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function cancelarSubstituicao(
  payload: CancelarSubstituicaoPayload,
): Promise<{ id: string }> {
  assertMutationsEnabled('/backend/v1/substituicoes/cancelar')
  return pb.send('/backend/v1/substituicoes/cancelar', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─────────────────────────────────────────────────────────────────────
// Funções de leitura — NÃO referenciam assertMutationsEnabled
// ─────────────────────────────────────────────────────────────────────

export async function consultarSubstituicoes(
  params: Omit<ConsultaSubstituicoesParams, 'id'>,
): Promise<ConsultaSubstituicoesResponse> {
  return pb.send('/backend/v1/substituicoes/consulta', {
    method: 'GET',
    query: toQueryParams(params as Record<string, unknown>),
  })
}

export async function obterSubstituicao(id: string): Promise<SubstituicaoView> {
  return pb.send('/backend/v1/substituicoes/consulta', {
    method: 'GET',
    query: toQueryParams({ id }),
  })
}

// ─────────────────────────────────────────────────────────────────────
// Mapeamento de erros do backend → mensagens em PT-BR (sem detalhes técnicos)
// Extrai httpStatus e código de error do ClientResponseError do PocketBase SDK.
// ─────────────────────────────────────────────────────────────────────

export function mapSubstituicaoError(err: unknown): string {
  let httpStatus = 0
  let codigo: string | undefined
  if (err && typeof err === 'object') {
    const e = err as {
      status?: number
      response?: { code?: number; error?: string }
    }
    httpStatus = e.status ?? e.response?.code ?? 0
    codigo = e.response?.error
  }
  if (httpStatus === 400) return 'Dados inválidos. Verifique os campos e tente novamente.'
  if (httpStatus === 401) return 'Sessão expirada. Faça login novamente.'
  if (httpStatus === 403) return 'Você não tem permissão para realizar esta operação.'
  if (httpStatus === 404) return 'Substituição não encontrada.'
  if (httpStatus === 500) return 'Erro interno. Tente novamente mais tarde.'
  if (httpStatus === 409) {
    switch (codigo) {
      case 'SOBREPOSICAO':
        return 'Já existe uma substituição no período informado para este titular.'
      case 'STALE_WRITE':
        return 'Os dados foram alterados por outro usuário. Recarregue a página e tente novamente.'
      case 'CONFLICT':
        return 'Conflito de idempotência. Tente novamente.'
      case 'CONCORRENTE':
        return 'Uma solicitação já está em andamento. Aguarde e tente novamente.'
      case 'CANCELADO':
        return 'Registros cancelados não podem ser ajustados.'
      case 'JANELA_FECHADA':
        return 'A janela da substituição já está aberta ou encerrada e não pode ser ajustada.'
      case 'JA_CANCELADO':
        return 'Esta substituição já foi cancelada.'
      case 'JANELA_ENCERRADA':
        return 'A janela da substituição já está encerrada e não pode ser cancelada.'
      default:
        return 'Erro inesperado. Tente novamente.'
    }
  }
  return 'Erro inesperado. Tente novamente.'
}
