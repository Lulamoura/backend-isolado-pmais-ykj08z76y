import { useState, useEffect, useRef } from 'react'
import {
  Play,
  Loader2,
  Lock,
  Copy,
  Download,
  ShieldOff,
  FileSearch,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'

interface AuditEvidence {
  captured_from: 'HTTP_RESPONSE' | 'FETCH_ERROR'
  http_status: number
  captured_at: string
  route: string
  raw_response: string
  parsed?: {
    query_succeeded?: boolean
    target_identity_verified?: Record<string, boolean> | boolean
    dependency_query_succeeded?: boolean
    dependency_count?: number | null
    counts?: Record<string, number> | null
    lock_state_read_succeeded?: boolean
    v7_lock?: { key: string; state: string | null; modified: boolean }
    records_created?: number
    records_updated?: number
    records_deleted?: number
    locks_modified?: number
    activecampaign_calls?: number
    external_calls?: number
  } | null
}

const SESSION_KEY = 'ac_diag_compensacao_audit_evidence'
const ROUTE_PATH = '/backend/v1/integracao/ac/diag-compensacao-auditoria'
const AUDIT_VERSION = 'R13-DIAG-COMPENSACAO-AUDITORIA-20260812-v3'
const FRONTEND_BUNDLE = 'R13-DIAG-COMPENSACAO-AUDITORIA-FRONTEND-20260812-v4'
const EXECUTION_ENABLED = true
const BUTTON_ENABLED = true
const READ_ONLY = true
const NOT_VERIFIED = 'não verificado nesta sessão'
const INVALID_WARNING = 'Resposta inválida ou incompleta — evidência não homologável'

const REQUIRED_COLLECTION_KEYS = [
  'com_vinculos_externos',
  'com_eventos_integracao',
  'com_execucoes_sincronizacao',
  'com_ocorrencias_qualidade',
] as const

const REQUIRED_IDENTITY_KEYS = [
  'com_vinculos_externos',
  'com_eventos_integracao',
  'com_execucoes_sincronizacao',
] as const

function loadFromSession(): AuditEvidence | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuditEvidence
    if (parsed && typeof parsed.raw_response === 'string') return parsed
    return null
  } catch {
    return null
  }
}

function saveToSession(data: AuditEvidence) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
  } catch {
    /* ignore quota */
  }
}

function tryParse(raw: string): AuditEvidence['parsed'] {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean'
}

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

interface VerifiedValues {
  dataWrites: string
  deletionExecuted: string
  activeCampaignCalls: string
  v7LockState: string
  lockStateReadSucceeded: string
  dependencyQuerySucceeded: string
  dependencyCount: string
  counts: Record<string, string>
  targetIdentityVerified: Record<string, string>
  locksModified: string
  externalCalls: string
  recordsCreated: string
  recordsUpdated: string
  recordsDeleted: string
}

function validateEvidence(evidence: AuditEvidence | null): {
  valid: boolean
  values: VerifiedValues
} {
  const notVerified = NOT_VERIFIED
  const defaultValues: VerifiedValues = {
    dataWrites: notVerified,
    deletionExecuted: notVerified,
    activeCampaignCalls: notVerified,
    v7LockState: notVerified,
    lockStateReadSucceeded: notVerified,
    dependencyQuerySucceeded: notVerified,
    dependencyCount: notVerified,
    counts: Object.fromEntries(REQUIRED_COLLECTION_KEYS.map((k) => [k, notVerified])),
    targetIdentityVerified: Object.fromEntries(REQUIRED_IDENTITY_KEYS.map((k) => [k, notVerified])),
    locksModified: notVerified,
    externalCalls: notVerified,
    recordsCreated: notVerified,
    recordsUpdated: notVerified,
    recordsDeleted: notVerified,
  }

  if (!evidence) return { valid: false, values: defaultValues }
  if (evidence.captured_from !== 'HTTP_RESPONSE') return { valid: false, values: defaultValues }
  if (evidence.http_status < 200 || evidence.http_status > 299)
    return { valid: false, values: defaultValues }

  const p = evidence.parsed
  if (!p || typeof p !== 'object') return { valid: false, values: defaultValues }
  if (p.query_succeeded !== true) return { valid: false, values: defaultValues }
  if (p.lock_state_read_succeeded !== true) return { valid: false, values: defaultValues }
  if (p.dependency_query_succeeded !== true) return { valid: false, values: defaultValues }

  if (!isNumber(p.records_created)) return { valid: false, values: defaultValues }
  if (!isNumber(p.records_updated)) return { valid: false, values: defaultValues }
  if (!isNumber(p.records_deleted)) return { valid: false, values: defaultValues }
  if (!isNumber(p.locks_modified)) return { valid: false, values: defaultValues }
  if (!isNumber(p.activecampaign_calls)) return { valid: false, values: defaultValues }
  if (!isNumber(p.external_calls)) return { valid: false, values: defaultValues }

  if (!isNumber(p.dependency_count)) return { valid: false, values: defaultValues }

  if (!p.v7_lock || !isObject(p.v7_lock)) return { valid: false, values: defaultValues }
  if (!isString(p.v7_lock.state)) return { valid: false, values: defaultValues }
  if (!isBoolean(p.v7_lock.modified)) return { valid: false, values: defaultValues }

  if (!p.counts || !isObject(p.counts)) return { valid: false, values: defaultValues }
  for (const key of REQUIRED_COLLECTION_KEYS) {
    if (!isNumber(p.counts[key])) return { valid: false, values: defaultValues }
  }

  if (!p.target_identity_verified || !isObject(p.target_identity_verified))
    return { valid: false, values: defaultValues }
  for (const key of REQUIRED_IDENTITY_KEYS) {
    if (!isBoolean(p.target_identity_verified[key])) return { valid: false, values: defaultValues }
  }

  const dataWrites = p.records_created + p.records_updated + p.records_deleted

  return {
    valid: true,
    values: {
      dataWrites: String(dataWrites),
      deletionExecuted: String(p.records_deleted > 0),
      activeCampaignCalls: String(p.activecampaign_calls),
      v7LockState: p.v7_lock.state,
      lockStateReadSucceeded: String(p.lock_state_read_succeeded),
      dependencyQuerySucceeded: String(p.dependency_query_succeeded),
      dependencyCount: String(p.dependency_count),
      counts: Object.fromEntries(REQUIRED_COLLECTION_KEYS.map((k) => [k, String(p.counts![k])])),
      targetIdentityVerified: Object.fromEntries(
        REQUIRED_IDENTITY_KEYS.map((k) => [k, String(p.target_identity_verified![k])]),
      ),
      locksModified: String(p.locks_modified),
      externalCalls: String(p.external_calls),
      recordsCreated: String(p.records_created),
      recordsUpdated: String(p.records_updated),
      recordsDeleted: String(p.records_deleted),
    },
  }
}

export function DiagCompensacaoAuditEvidenceBlock() {
  const { isSuperAdmin, loading: saLoading } = useIsSuperAdmin()
  const [evidence, setEvidence] = useState<AuditEvidence | null>(null)
  const [executing, setExecuting] = useState(false)
  const executedRef = useRef(false)

  useEffect(() => {
    const saved = loadFromSession()
    if (saved) {
      setEvidence(saved)
      executedRef.current = true
    }
  }, [])

  if (saLoading) return null
  if (!isSuperAdmin) return null

  const handleExecute = async () => {
    if (executedRef.current || executing || !EXECUTION_ENABLED || !BUTTON_ENABLED) return
    setExecuting(true)
    executedRef.current = true

    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}${ROUTE_PATH}`, {
        method: 'GET',
        headers: {
          Authorization: pb.authStore.token || '',
        },
      })

      const rawText = await res.text()

      const data: AuditEvidence = {
        captured_from: 'HTTP_RESPONSE',
        http_status: res.status,
        captured_at: new Date().toISOString(),
        route: ROUTE_PATH,
        raw_response: rawText,
        parsed: tryParse(rawText),
      }

      saveToSession(data)
      setEvidence(data)

      if (res.ok) {
        toast.success('Auditoria de compensação executada — resposta HTTP capturada')
      } else {
        toast.warning(`Auditoria retornou HTTP ${res.status} — resposta capturada`)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      const data: AuditEvidence = {
        captured_from: 'FETCH_ERROR',
        http_status: 0,
        captured_at: new Date().toISOString(),
        route: ROUTE_PATH,
        raw_response: errorMessage,
        parsed: null,
      }
      saveToSession(data)
      setEvidence(data)
      toast.error('Erro de rede ao executar auditoria de compensação')
    } finally {
      setExecuting(false)
    }
  }

  const handleCopy = async () => {
    if (!evidence || !evidence.raw_response) return
    try {
      await navigator.clipboard.writeText(evidence.raw_response)
      toast.success('JSON bruto copiado')
    } catch {
      toast.error('Falha ao copiar')
    }
  }

  const handleDownload = () => {
    if (!evidence || !evidence.raw_response) return
    const blob = new Blob([evidence.raw_response], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `diag-compensacao-auditoria-${evidence.captured_at.replace(/[:.]/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const canCopyDownload = !!evidence && !!evidence.raw_response
  const buttonDisabled = !BUTTON_ENABLED || !EXECUTION_ENABLED || executedRef.current || executing

  const { valid, values } = validateEvidence(evidence)
  const hasEvidence = !!evidence
  const hasHttpResponse = hasEvidence && evidence.captured_from === 'HTTP_RESPONSE'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSearch className="h-4 w-4" />
          Auditoria de Compensação — Controle Somente-Leitura
          <Badge variant="outline" className="ml-auto text-xs font-mono">
            {FRONTEND_BUNDLE}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">Audit Version:</span>
            <code className="text-foreground">{AUDIT_VERSION}</code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">Frontend Bundle:</span>
            <code className="text-foreground">{FRONTEND_BUNDLE}</code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">Route:</span>
            <code className="text-foreground">GET {ROUTE_PATH}</code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">Read Only:</span>
            <Badge variant={READ_ONLY ? 'default' : 'destructive'}>{String(READ_ONLY)}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">Client Parameters:</span>
            <Badge variant="outline">0 (ignored)</Badge>
          </div>
        </div>

        {!valid && hasEvidence && (
          <div className="flex items-start gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-600 shrink-0" />
            <span className="text-sm text-yellow-700 font-medium">{INVALID_WARNING}</span>
          </div>
        )}

        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground mb-1">Estado da Auditoria</div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">execution_enabled:</span>
            <Badge variant={EXECUTION_ENABLED ? 'default' : 'destructive'}>
              {String(EXECUTION_ENABLED)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">button_enabled:</span>
            <Badge variant={BUTTON_ENABLED ? 'default' : 'destructive'}>
              {String(BUTTON_ENABLED)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">executed:</span>
            <Badge variant={executedRef.current ? 'default' : 'outline'}>
              {String(executedRef.current)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">evidence_valid:</span>
            <Badge variant={valid ? 'default' : 'destructive'}>{String(valid)}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">deletion_executed:</span>
            <Badge variant="outline">{values.deletionExecuted}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">v7_lock_state:</span>
            <Badge variant="secondary">{values.v7LockState}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">lock_state_read_succeeded:</span>
            <Badge variant="outline">{values.lockStateReadSucceeded}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">dependency_query_succeeded:</span>
            <Badge variant="outline">{values.dependencyQuerySucceeded}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">dependency_count:</span>
            <Badge variant="outline">{values.dependencyCount}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">activecampaign_calls:</span>
            <Badge variant="outline">{values.activeCampaignCalls}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">external_calls:</span>
            <Badge variant="outline">{values.externalCalls}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">data_writes:</span>
            <Badge variant="outline">{values.dataWrites}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">locks_modified:</span>
            <Badge variant="outline">{values.locksModified}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">records_created:</span>
            <Badge variant="outline">{values.recordsCreated}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">records_updated:</span>
            <Badge variant="outline">{values.recordsUpdated}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">records_deleted:</span>
            <Badge variant="outline">{values.recordsDeleted}</Badge>
          </div>
        </div>

        {valid && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Identidades Verificadas
            </div>
            {REQUIRED_IDENTITY_KEYS.map((key) => (
              <div
                key={key}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono"
              >
                <span className="text-muted-foreground">{key}:</span>
                <Badge
                  variant={
                    values.targetIdentityVerified[key] === 'true' ? 'default' : 'destructive'
                  }
                >
                  {values.targetIdentityVerified[key]}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {valid && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Contagens (Read-Only)
            </div>
            {REQUIRED_COLLECTION_KEYS.map((key) => (
              <div
                key={key}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono"
              >
                <span className="text-muted-foreground">{key}:</span>
                <Badge variant="outline">{values.counts[key]}</Badge>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={buttonDisabled} variant="default" size="sm" onClick={handleExecute}>
            {executing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : !EXECUTION_ENABLED || !BUTTON_ENABLED ? (
              <ShieldOff className="h-4 w-4" />
            ) : executedRef.current ? (
              <Lock className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Executar auditoria somente-leitura
          </Button>

          {executedRef.current && (
            <Badge variant="secondary" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              Bloqueado para esta sessão
            </Badge>
          )}
        </div>

        <div className="flex gap-2">
          <Button onClick={handleCopy} variant="outline" size="sm" disabled={!canCopyDownload}>
            <Copy className="h-4 w-4 mr-1" />
            Copiar
          </Button>
          <Button onClick={handleDownload} variant="outline" size="sm" disabled={!canCopyDownload}>
            <Download className="h-4 w-4 mr-1" />
            Baixar
          </Button>
        </div>

        {evidence && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge
                variant={evidence.captured_from === 'HTTP_RESPONSE' ? 'default' : 'destructive'}
              >
                {evidence.captured_from}
              </Badge>
              {evidence.http_status > 0 && (
                <Badge
                  variant={
                    evidence.http_status >= 200 && evidence.http_status < 300
                      ? 'default'
                      : 'destructive'
                  }
                >
                  HTTP {evidence.http_status}
                </Badge>
              )}
              <span className="text-muted-foreground text-xs">
                {new Date(evidence.captured_at).toLocaleString('pt-BR')}
              </span>
            </div>

            <div className="rounded-lg border bg-muted/50 p-3">
              <pre className="max-h-[600px] overflow-auto text-xs font-mono whitespace-pre-wrap break-all">
                {evidence.raw_response}
              </pre>
            </div>
          </div>
        )}

        {!evidence && !executing && (
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">
              Nenhuma evidência de auditoria de compensação capturada. O botão "Executar auditoria
              somente-leitura" está habilitado. A rota é {`GET ${ROUTE_PATH}`}, estritamente
              somente-leitura, não consome locks e não faz chamadas externas. Os campos
              v7_lock_state, data_writes, deletion_executed e activecampaign_calls mostram "
              {NOT_VERIFIED}" até que a auditoria seja executada e a resposta seja totalmente
              validada.
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              Bundle: {FRONTEND_BUNDLE} | Route: GET {ROUTE_PATH}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
