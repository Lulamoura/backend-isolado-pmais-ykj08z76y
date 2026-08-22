import pb from '@/lib/pocketbase/client'

// ─────────────────────────────────────────────────────────────────────
// Tipos (definidos inline — nunca importar de si mesmo)
// ─────────────────────────────────────────────────────────────────────

export interface FilaSemCoberturaParams {
  pagina?: number
  por_pagina?: number
  ordenar_por?: 'titulo' | 'valor' | 'etapa' | 'created'
  ordem?: 'asc' | 'desc'
}

export interface FilaItem {
  id: string
  titulo: string
  valor: number
  etapa: string
  responsavel: { id: string; name: string } | null
  equipe: { id: string; nome: string } | null
  ausencia: {
    id: string
    data_inicio: string
    data_fim: string
    motivo: string
  } | null
}

export interface FilaSemCoberturaResponse {
  negocios_sem_cobertura: FilaItem[]
  pagina: number
  por_pagina: number
  has_more: boolean
}

// ─────────────────────────────────────────────────────────────────────
// toQueryParams — omite undefined/null, number→String(n), preserva string
// (duplicado intencionalmente — não extrair para lib separada)
// ─────────────────────────────────────────────────────────────────────

function toQueryParams(params: Record<string, unknown>): Record<string, string> {
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
// Leitura — NÃO referencia assertMutationsEnabled
// ─────────────────────────────────────────────────────────────────────

export async function getFilaSemCobertura(
  params?: FilaSemCoberturaParams,
): Promise<FilaSemCoberturaResponse> {
  return pb.send('/backend/v1/fila/sem-cobertura', {
    method: 'GET',
    query: toQueryParams((params ?? {}) as Record<string, unknown>),
  })
}
