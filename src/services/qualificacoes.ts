import pb from '@/lib/pocketbase/client'

export interface QualificacaoPendente {
  id: string
  external_id: string | null
  titulo: string
  descricao: string | null
  origem_canal: string | null
  tipo_entrada: 'pendente' | 'pre_qualificada'
  qualificacao: 'pendente'
  empresa: { id: string; nome: string } | null
  contato: { id: string; nome: string | null; email: string | null; telefone: string | null } | null
  responsavel: { id: string; nome: string } | null
  responsavel_qualificacao: { id: string; nome: string } | null
  qualificacao_assumida_em: string | null
  proxima_acao_em: string | null
  created: string
  updated: string
}

export interface QualificacoesPendentesResponse {
  itens: QualificacaoPendente[]
  responsaveis_qualificacao: Array<{ id: string; nome: string }>
  indicadores: IndicadorQualificacao[]
  pagina: number
  por_pagina: number
  tem_mais: boolean
}

export interface IndicadorQualificacao {
  usuario_id: string
  nome: string
  assumidos: number
  qualificados: number
  desqualificados: number
  taxa_qualificacao: number
  devolvidos: number
  tempo_medio_assumir_horas: number | null
  tempo_medio_decidir_horas: number | null
}

export interface DecidirQualificacaoPayload {
  negocio_id: string
  decisao: 'qualificada' | 'desqualificada'
  motivo: string | null
  justificativa: string | null
  updated_esperado: string
  command_idempotency_key: string
}

export function listarQualificacoesPendentes(pagina = 1, porPagina = 20) {
  return pb.send<QualificacoesPendentesResponse>('/backend/v1/qualificacoes/pendentes', {
    method: 'GET',
    query: { pagina: String(pagina), por_pagina: String(porPagina) },
  })
}

export function decidirQualificacao(payload: DecidirQualificacaoPayload) {
  return pb.send<{ negocio_id: string; qualificacao: string; historico_id: string }>(
    '/backend/v1/qualificacoes/decidir',
    {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

export function assumirQualificacao(negocioId: string, updatedEsperado: string) {
  return pb.send<{ negocio_id: string; qualificacao_responsavel_id: string; updated: string }>(
    '/backend/v1/qualificacoes/assumir',
    {
      method: 'POST',
      body: JSON.stringify({ negocio_id: negocioId, updated_esperado: updatedEsperado }),
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

export function atribuirQualificacao(
  negocioId: string,
  responsavelId: string,
  updatedEsperado: string,
) {
  return pb.send('/backend/v1/qualificacoes/atribuir', {
    method: 'POST',
    body: JSON.stringify({
      negocio_id: negocioId,
      responsavel_id: responsavelId,
      updated_esperado: updatedEsperado,
    }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export function devolverQualificacao(
  negocioId: string,
  updatedEsperado: string,
  justificativa: string,
) {
  return pb.send('/backend/v1/qualificacoes/devolver', {
    method: 'POST',
    body: JSON.stringify({
      negocio_id: negocioId,
      updated_esperado: updatedEsperado,
      justificativa,
      command_idempotency_key: `qualificacao:devolver:${negocioId}:${crypto.randomUUID()}`,
    }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export function novaChaveQualificacao(negocioId: string): string {
  return `qualificacao:${negocioId}:${crypto.randomUUID()}`.slice(0, 128)
}

export function mapQualificacaoError(err: unknown): string {
  const e = err as { status?: number; response?: { error?: string } }
  const code = e?.response?.error
  if (e?.status === 403) return 'Você não tem permissão para decidir esta qualificação.'
  if (code === 'STALE_WRITE') return 'O negócio foi alterado. Atualize a lista e tente novamente.'
  if (code === 'JA_DECIDIDO') return 'Este prospect já recebeu uma decisão.'
  if (code === 'MOTIVO_OBRIGATORIO') return 'Informe o motivo da desqualificação.'
  if (code === 'CONCORRENTE') return 'A decisão já está sendo processada. Aguarde.'
  return 'Não foi possível registrar a decisão. Tente novamente.'
}
