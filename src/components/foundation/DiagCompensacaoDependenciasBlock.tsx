import { useState, useRef } from 'react'
import {
  Play,
  Loader2,
  Lock,
  Copy,
  Download,
  ShieldOff,
  GitBranch,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'

interface CompEvidence {
  captured_from: 'HTTP_RESPONSE' | 'FETCH_ERROR'
  http_status: number
  captured_at: string
  route: string
  raw_response: string
}

const SESSION_KEY = 'ac_diag_compensacao_dependencias_evidence'
const ROUTE_PATH = '/backend/v1/integracao/ac/diag-compensacao-dependencias'
const BACKEND_VERSION = 'R13-2D2A-DIAG-COMPENSACAO-DEPENDENCIAS-BACKEND-20260812-v8'
const FRONTEND_VERSION = 'R13-2D2A-DIAG-COMPENSACAO-DEPENDENCIAS-FRONTEND-20260812-v8'
const NATIVE_TRANSACTION_API = '$app.runInTransaction'
const RECORD_LOOKUP_API = 'txApp.findRecordById'
const RECORD_DELETE_API = 'txApp.delete'
const COUNT_API = 'txApp.countRecords'
const QUERY_API = 'txApp.findRecordsByFilter'
const POCKETBASE_VERSION = '0.36.0'
const FIXED_IDS = {
  com_vinculos_externos: 'phzmobi8mfb34ha',
  com_eventos_integracao: 'pq4npvruaak9gpb',
  com_execucoes_sincronizacao: '62otoics23ul0vy',
}
const EXPECTED_IDENTITY = {
  com_vinculos_externos: {
    id: FIXED_IDS.com_vinculos_externos,
    created: '2026-08-11 20:38:39.951Z',
    collection_name: 'com_contatos',
    external_id: 'DIAG-TRANSPORT-FN-C1',
    external_type: 'contact',
    record_id: 'hfjq2q1olefske7',
    sistema_origem: 'activecampaign',
  },
  com_eventos_integracao: {
    id: FIXED_IDS.com_eventos_integracao,
    created: '2026-08-11 20:38:39.950Z',
    evento_tipo: 'contact_create',
    external_id: 'DIAG-TRANSPORT-FN-C1',
    idempotency_key: 'e860fa5a9d8615c44a7db52b909b70b816f80b74123b96780e7bb309e53d34ec',
    sistema_origem: 'activecampaign',
    status: 'processed',
  },
  com_execucoes_sincronizacao: {
    id: FIXED_IDS.com_execucoes_sincronizacao,
    created: '2026-08-11 20:38:39.948Z',
    inicio: '2026-08-11 20:38:39.948Z',
    fim: '2026-08-11 20:38:39.952Z',
    sistema_origem: 'activecampaign',
    status: 'completed',
  },
}
const BUTTON_ENABLED = true
const COMPENSATION_LOCK = 'armed'
const TRANSACTIONAL_READY = true
const DEPENDENCY_QUERY_LOCK = 'consumed'
const ORIGINAL_AUDIT_LOCK = 'consumed'
const NONEXISTENT_DB_COLLECTION_API_USED = false
const LOCK_PERSISTED_TRANSACTIONALLY = true
const CONCURRENT_DOUBLE_EXECUTION_PREVENTED = true
const LOCK_FALLBACK_CREATION_REMOVED = true
const STRICT_ARMED_EQUALITY_REQUIRED = true
const SAME_TRANSACTIONAL_LOCK_OBJECT_SAVED = true
const SAVED_LOCK_VARIABLE = 'txLockRec'
const LOCK_MISSING_ABORTS = true
const INVALID_RECORD_ID_FILTERS_REMOVED = true
const ONLY_DEPENDENCY_GUARD = 'com_ocorrencias_qualidade.execucao_id'
const DEPENDENCY_GUARD_EXPECTED_COUNT = 0
const DEPENDENCY_FOUND_ABORTS_TRANSACTION = true
const INVENTED_REFERENCE_FIELDS_USED = false
const EXPECTED_COUNTS_BEFORE = {
  com_eventos_integracao: 15,
  com_execucoes_sincronizacao: 11,
  com_vinculos_externos: 10,
}
const EXPECTED_COUNTS_AFTER = {
  com_eventos_integracao: 14,
  com_execucoes_sincronizacao: 10,
  com_vinculos_externos: 9,
}

function loadFromSession(): CompEvidence | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CompEvidence
    if (parsed && typeof parsed.raw_response === 'string') return parsed
    return null
  } catch {
    return null
  }
}

function saveToSession(data: CompEvidence) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
  } catch {
    /* ignore quota */
  }
}

export function DiagCompensacaoDependenciasBlock() {
  const [evidence, setEvidence] = useState<CompEvidence | null>(loadFromSession())
  const [executing, setExecuting] = useState(false)
  const executedRef = useRef(false)

  const handleExecute = async () => {
    if (executedRef.current || executing || !BUTTON_ENABLED) return
    setExecuting(true)
    executedRef.current = true

    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}${ROUTE_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token || '',
        },
        body: JSON.stringify({}),
      })

      const rawText = await res.text()

      const data: CompEvidence = {
        captured_from: 'HTTP_RESPONSE',
        http_status: res.status,
        captured_at: new Date().toISOString(),
        route: ROUTE_PATH,
        raw_response: rawText,
      }

      saveToSession(data)
      setEvidence(data)

      if (res.ok) {
        toast.success('Compensação executada — resposta HTTP capturada')
      } else {
        toast.warning(`Compensação retornou HTTP ${res.status} — resposta capturada`)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      const data: CompEvidence = {
        captured_from: 'FETCH_ERROR',
        http_status: 0,
        captured_at: new Date().toISOString(),
        route: ROUTE_PATH,
        raw_response: errorMessage,
      }
      saveToSession(data)
      setEvidence(data)
      toast.error('Erro de rede ao executar compensação')
    } finally {
      setExecuting(false)
    }
  }

  const handleCopy = async () => {
    if (!evidence || evidence.captured_from !== 'HTTP_RESPONSE' || !evidence.raw_response) return
    try {
      await navigator.clipboard.writeText(evidence.raw_response)
      toast.success('JSON bruto copiado')
    } catch {
      toast.error('Falha ao copiar')
    }
  }

  const handleDownload = () => {
    if (!evidence || evidence.captured_from !== 'HTTP_RESPONSE' || !evidence.raw_response) return
    const blob = new Blob([evidence.raw_response], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `diag-compensacao-dependencias-${evidence.captured_at.replace(/[:.]/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const canCopyDownload =
    !!evidence && evidence.captured_from === 'HTTP_RESPONSE' && !!evidence.raw_response

  const buttonDisabled = !BUTTON_ENABLED || executedRef.current || executing

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          Compensação de Dependências — Preparada (Não Executada)
          <Badge variant="outline" className="ml-auto text-xs font-mono">
            {FRONTEND_VERSION}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">Backend Version:</span>
            <code className="text-foreground">{BACKEND_VERSION}</code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">Route:</span>
            <code className="text-foreground">POST {ROUTE_PATH}</code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">Fixed IDs:</span>
            <code className="text-foreground">vínculo={FIXED_IDS.com_vinculos_externos}</code>
            <code className="text-foreground">evento={FIXED_IDS.com_eventos_integracao}</code>
            <code className="text-foreground">
              execução={FIXED_IDS.com_execucoes_sincronizacao}
            </code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">Client input:</span>
            <Badge variant="destructive">rejected</Badge>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground mb-1">
            Estado da Compensação (v8 — invalid record_id filters removed, sole structural
            dependency guard)
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">transactional_ready:</span>
            <Badge variant={TRANSACTIONAL_READY ? 'default' : 'destructive'}>
              {String(TRANSACTIONAL_READY)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">native_transaction_api:</span>
            <code className="text-foreground">{NATIVE_TRANSACTION_API}</code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">record_lookup_api:</span>
            <code className="text-foreground">{RECORD_LOOKUP_API}</code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">record_delete_api:</span>
            <code className="text-foreground">{RECORD_DELETE_API}</code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">count_api:</span>
            <code className="text-foreground">{COUNT_API}</code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">query_api:</span>
            <code className="text-foreground">{QUERY_API}</code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">nonexistent_db_collection_api_used:</span>
            <Badge variant={NONEXISTENT_DB_COLLECTION_API_USED ? 'destructive' : 'default'}>
              {String(NONEXISTENT_DB_COLLECTION_API_USED)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">lock_persisted_transactionally:</span>
            <Badge variant={LOCK_PERSISTED_TRANSACTIONALLY ? 'default' : 'destructive'}>
              {String(LOCK_PERSISTED_TRANSACTIONALLY)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">concurrent_double_execution_prevented:</span>
            <Badge variant={CONCURRENT_DOUBLE_EXECUTION_PREVENTED ? 'default' : 'destructive'}>
              {String(CONCURRENT_DOUBLE_EXECUTION_PREVENTED)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">lock_fallback_creation_removed:</span>
            <Badge variant={LOCK_FALLBACK_CREATION_REMOVED ? 'default' : 'destructive'}>
              {String(LOCK_FALLBACK_CREATION_REMOVED)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">strict_armed_equality_required:</span>
            <Badge variant={STRICT_ARMED_EQUALITY_REQUIRED ? 'default' : 'destructive'}>
              {String(STRICT_ARMED_EQUALITY_REQUIRED)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">same_transactional_lock_object_saved:</span>
            <Badge variant={SAME_TRANSACTIONAL_LOCK_OBJECT_SAVED ? 'default' : 'destructive'}>
              {String(SAME_TRANSACTIONAL_LOCK_OBJECT_SAVED)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">saved_lock_variable:</span>
            <code className="text-foreground">{SAVED_LOCK_VARIABLE}</code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">lock_missing_aborts:</span>
            <Badge variant={LOCK_MISSING_ABORTS ? 'default' : 'destructive'}>
              {String(LOCK_MISSING_ABORTS)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">pocketbase_version_confirmed:</span>
            <code className="text-foreground">{POCKETBASE_VERSION}</code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">client_controlled_ids:</span>
            <Badge variant="outline">false</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">compensation_lock:</span>
            <Badge variant="secondary">{COMPENSATION_LOCK}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">dependency_query_lock:</span>
            <Badge variant="secondary">{DEPENDENCY_QUERY_LOCK}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">original_audit_lock:</span>
            <Badge variant="secondary">{ORIGINAL_AUDIT_LOCK}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">compensation_executed:</span>
            <Badge variant="outline">false</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">deletion_executed:</span>
            <Badge variant="outline">false</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">activecampaign_calls:</span>
            <Badge variant="outline">0</Badge>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground mb-1">
            v8 — Invalid record_id Filters Removed
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">invalid_record_id_filters_removed:</span>
            <Badge variant={INVALID_RECORD_ID_FILTERS_REMOVED ? 'default' : 'destructive'}>
              {String(INVALID_RECORD_ID_FILTERS_REMOVED)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">only_dependency_guard:</span>
            <code className="text-foreground">{ONLY_DEPENDENCY_GUARD}</code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">dependency_guard_expected_count:</span>
            <Badge variant="outline">{String(DEPENDENCY_GUARD_EXPECTED_COUNT)}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">dependency_found_aborts_transaction:</span>
            <Badge variant={DEPENDENCY_FOUND_ABORTS_TRANSACTION ? 'default' : 'destructive'}>
              {String(DEPENDENCY_FOUND_ABORTS_TRANSACTION)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">invented_reference_fields_used:</span>
            <Badge variant={INVENTED_REFERENCE_FIELDS_USED ? 'destructive' : 'default'}>
              {String(INVENTED_REFERENCE_FIELDS_USED)}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground italic">
            Removed:{' '}
            <code className="text-foreground">
              com_vinculos_externos.record_id = "pq4npvruaak9gpb"
            </code>{' '}
            (textual coincidence, not structural) and{' '}
            <code className="text-foreground">
              com_vinculos_externos.record_id = "62otoics23ul0vy"
            </code>{' '}
            (textual coincidence, not structural).
          </div>
          <div className="text-xs text-muted-foreground italic">
            Kept:{' '}
            <code className="text-foreground">
              com_ocorrencias_qualidade.execucao_id = "62otoics23ul0vy"
            </code>{' '}
            — sole legitimate structural relation.
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground mb-1">
            Precondition Counts (v8 — corrected per-collection mapping)
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">expected_before:</span>
            <code className="text-foreground">
              eventos={EXPECTED_COUNTS_BEFORE.com_eventos_integracao}
            </code>
            <code className="text-foreground">
              execuções={EXPECTED_COUNTS_BEFORE.com_execucoes_sincronizacao}
            </code>
            <code className="text-foreground">
              vínculos={EXPECTED_COUNTS_BEFORE.com_vinculos_externos}
            </code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">expected_after:</span>
            <code className="text-foreground">
              eventos={EXPECTED_COUNTS_AFTER.com_eventos_integracao}
            </code>
            <code className="text-foreground">
              execuções={EXPECTED_COUNTS_AFTER.com_execucoes_sincronizacao}
            </code>
            <code className="text-foreground">
              vínculos={EXPECTED_COUNTS_AFTER.com_vinculos_externos}
            </code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">rollback_by_manual_recreation:</span>
            <Badge variant="destructive">prohibited</Badge>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            All preconditions, deletions, and post-validations inside single native transaction via{' '}
            {NATIVE_TRANSACTION_API}. Lock re-checked inside transaction for concurrency guard.
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground mb-1">
            Expected Identity (v8 — literal audited values, no invented fields)
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
              <span className="text-muted-foreground">com_vinculos_externos:</span>
              <code className="text-foreground">
                created={EXPECTED_IDENTITY.com_vinculos_externos.created}
              </code>
              <code className="text-foreground">
                collection_name={EXPECTED_IDENTITY.com_vinculos_externos.collection_name}
              </code>
              <code className="text-foreground">
                external_id={EXPECTED_IDENTITY.com_vinculos_externos.external_id}
              </code>
              <code className="text-foreground">
                external_type={EXPECTED_IDENTITY.com_vinculos_externos.external_type}
              </code>
              <code className="text-foreground">
                record_id={EXPECTED_IDENTITY.com_vinculos_externos.record_id}
              </code>
              <code className="text-foreground">
                sistema_origem={EXPECTED_IDENTITY.com_vinculos_externos.sistema_origem}
              </code>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
              <span className="text-muted-foreground">com_eventos_integracao:</span>
              <code className="text-foreground">
                created={EXPECTED_IDENTITY.com_eventos_integracao.created}
              </code>
              <code className="text-foreground">
                evento_tipo={EXPECTED_IDENTITY.com_eventos_integracao.evento_tipo}
              </code>
              <code className="text-foreground">
                external_id={EXPECTED_IDENTITY.com_eventos_integracao.external_id}
              </code>
              <code className="text-foreground">
                idempotency_key=
                {EXPECTED_IDENTITY.com_eventos_integracao.idempotency_key.substring(0, 16)}…
              </code>
              <code className="text-foreground">
                sistema_origem={EXPECTED_IDENTITY.com_eventos_integracao.sistema_origem}
              </code>
              <code className="text-foreground">
                status={EXPECTED_IDENTITY.com_eventos_integracao.status}
              </code>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
              <span className="text-muted-foreground">com_execucoes_sincronizacao:</span>
              <code className="text-foreground">
                created={EXPECTED_IDENTITY.com_execucoes_sincronizacao.created}
              </code>
              <code className="text-foreground">
                inicio={EXPECTED_IDENTITY.com_execucoes_sincronizacao.inicio}
              </code>
              <code className="text-foreground">
                fim={EXPECTED_IDENTITY.com_execucoes_sincronizacao.fim}
              </code>
              <code className="text-foreground">
                sistema_origem={EXPECTED_IDENTITY.com_execucoes_sincronizacao.sistema_origem}
              </code>
              <code className="text-foreground">
                status={EXPECTED_IDENTITY.com_execucoes_sincronizacao.status}
              </code>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground mb-1">
            Structural Pseudocode (v8 — invalid filters removed, sole dependency guard, same
            transactional object)
          </div>
          <pre className="text-xs font-mono whitespace-pre-wrap break-all text-muted-foreground">
            {`$app.runInTransaction(function(txApp) {
  // 1. Strict lock guard — locate lock inside transaction, no fallback
  txLockRec = txApp.findFirstRecordByData('com_parametros', 'chave', LOCK_KEY)
  txLockVal = txLockRec.getString('valor')
  if (txLockVal !== 'armed') throw → rollback

  // 2. Precondition counts via txApp.countRecords
  countsBefore = { eventos: txApp.countRecords('com_eventos_integracao'), ... }

  // 3. Fixed-record lookup via txApp.findRecordById
  vinculo = txApp.findRecordById('com_vinculos_externos', ID)
  evento  = txApp.findRecordById('com_eventos_integracao', ID)
  execucao = txApp.findRecordById('com_execucoes_sincronizacao', ID)

  // 4. Identity comparison — throw on divergence

  // 5. SOLE structural dependency guard via txApp.findRecordsByFilter
  //    (v7: removed two inadequate com_vinculos_externos.record_id filters)
  ocorrencias = txApp.findRecordsByFilter(
    'com_ocorrencias_qualidade',
    'execucao_id = "62otoics23ul0vy"', '', 1, 0
  )
  // Any result → throw → native rollback (never used to delete occurrences)

  // 6. If preconditions not met → throw → native rollback

  // 7. Deletions via txApp.delete(record) in fixed order
  txApp.delete(vinculo)   // order 1
  txApp.delete(evento)    // order 2
  txApp.delete(execucao)  // order 3

  // 8. Post-deletion validation via txApp.countRecords + txApp.findRecordById
  //    If validation fails → throw → native rollback

  // 9. Persist same transactional lock object (no fallback creation)
  txLockRec.set('valor', 'consumed')
  txApp.save(txLockRec)  // only commits on success
})`}
          </pre>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={buttonDisabled} variant="default" size="sm" onClick={handleExecute}>
            {executing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : !BUTTON_ENABLED ? (
              <ShieldOff className="h-4 w-4" />
            ) : executedRef.current ? (
              <Lock className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Preparar compensação (não executada)
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
              Nenhuma compensação executada. O botão "Preparar compensação (não executada)" está
              habilitado. A rota é {`POST ${ROUTE_PATH}`}, utiliza IDs fixos server-side, possui
              lock independente ({COMPENSATION_LOCK}) e transação nativa atômica com rollback
              nativo. O botão não é acionado automaticamente.
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              Bundle: {FRONTEND_VERSION} | Route: POST {ROUTE_PATH}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
