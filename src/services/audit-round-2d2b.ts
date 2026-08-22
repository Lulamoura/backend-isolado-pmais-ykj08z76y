import pb from '@/lib/pocketbase/client'

const AUDIT_ROUTE = '/backend/v1/integracao/ac/audit-round-2d2b'

export interface CapturedAuditRound2D2B {
  httpStatus: number
  rawBody: string
  parsedBody?: unknown
}

/**
 * Captura HTTP real (wire-level) da rota de auditoria 2D.2B.
 *
 * Ao contrário de `auditRound2D2B()` (que retorna apenas o corpo já
 * desserializado pelo SDK), esta função executa uma única GET autenticada
 * via `fetch()` nativo usando o token do authStore do PocketBase SDK e
 * captura:
 *  - `httpStatus`: o status HTTP REAL retornado pelo servidor
 *    (campo `status` do objeto Response do fetch — nunca fixo).
 *  - `rawBody`: o texto bruto recebido ANTES de qualquer JSON.parse
 *    (campo `text()` do Response — nunca JSON.stringify).
 *  - `parsedBody`: resultado de `JSON.parse(rawBody)` quando possível,
 *    exposto opcionalmente para leitura estruturada de campos sem
 *    substituir o `rawBody` exibido.
 *
 * Não expõe token, Authorization nem headers sensíveis no retorno.
 * Não reconstrói o corpo bruto com JSON.stringify.
 * Não fixa 200.
 */
export async function captureAuditRound2D2B(): Promise<CapturedAuditRound2D2B> {
  const base = (import.meta.env.VITE_POCKETBASE_URL ?? '').replace(/\/$/, '')
  const url = `${base}${AUDIT_ROUTE}`
  const token = pb.authStore.token || ''

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: token,
    },
  })

  const rawBody = await response.text()
  const httpStatus = response.status

  let parsedBody: unknown
  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : undefined
  } catch {
    parsedBody = undefined
  }

  return {
    httpStatus,
    rawBody,
    parsedBody,
  }
}

export interface AuditParamState {
  exists: boolean
  readError: boolean
  id: string | null
  valor: string | null
  ativo: boolean | null
  tipo: string | null
  versao: string | null
  created: string | null
  updated: string | null
  note?: string
}

export interface AuditEvidenceItem {
  collection: string
  id: string | null
  created: string
  updated: string
  [key: string]: unknown
}

export interface AuditEvidenceCollection {
  count: number
  items: AuditEvidenceItem[]
  truncated: boolean
}

export interface AuditCorrelation {
  [key: string]: boolean | string | null
}

export interface AuditEvidenceMappingEntry {
  found: boolean | null
  not_reconstructable: boolean
  description: string
  evidence: string[]
  correlation?: AuditCorrelation
  anomaly_detected?: boolean
}

export interface AuditGap {
  gap: string
  description: string
}

export interface AuditAnomaly {
  type: string
  description: string
}

export interface AuditReadError {
  collection: string
  operation: string
  error: string
}

export interface AuditLogicalOperatorsFinding {
  call: string
  check: string
  verified: boolean
}

export interface AuditLogicalOperatorsVerification {
  inspected_file: string
  verified: boolean
  findings: AuditLogicalOperatorsFinding[]
  summary: string
}

export interface AuditDeclaredCodeProperties {
  nature: string
  write_primitives_absent: boolean
  write_primitives_check: string
  external_http_calls_absent: boolean
  external_http_calls_check: string
  readparam_logic: string
  logical_operators_verified: boolean
  logical_operators_summary: string
  search_case_insensitive_removed: boolean
  search_case_insensitive_check: string
  pagination_implemented: boolean
  pagination_check: string
  correlation_implemented: boolean
  correlation_check: string
  sanitized_evidence: boolean
  sanitization_check: string
}

export interface AuditRound2D2BResponse {
  route: string
  route_version: string
  read_only: boolean
  writes_performed: number
  external_calls: number
  started_at: string
  finished_at: string
  correlation_key: string
  lock: AuditParamState
  flag: AuditParamState
  counts: Record<string, number>
  counts_note: string
  evidence: Record<string, AuditEvidenceCollection>
  evidence_mapping: Record<string, AuditEvidenceMappingEntry>
  classification: string
  classification_justification: string
  original_pass_go_reconstructable: boolean
  original_pass_go_note: string
  gaps: AuditGap[]
  anomalies: AuditAnomaly[]
  read_errors: AuditReadError[]
  monitored_collections: string[]
  search_pattern: string
  search_variants: string[]
  search_case_insensitive: boolean
  search_case_note: string
  expected_correlation_keys: string[]
  logical_operators_verification: AuditLogicalOperatorsVerification
  declared_code_properties: AuditDeclaredCodeProperties
  deployment_target: string
  production_promoted: boolean
}

export async function auditRound2D2B(): Promise<AuditRound2D2BResponse> {
  const response = await pb.send('/backend/v1/integracao/ac/audit-round-2d2b', { method: 'GET' })
  return response
}
