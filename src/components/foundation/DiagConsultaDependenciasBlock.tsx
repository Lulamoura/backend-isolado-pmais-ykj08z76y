import { useState, useRef } from 'react'
import { Play, Loader2, Lock, Copy, Download, ShieldOff, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'

interface DependencyEvidence {
  captured_from: 'HTTP_RESPONSE' | 'FETCH_ERROR'
  http_status: number
  captured_at: string
  route: string
  raw_response: string
}

const SESSION_KEY = 'ac_diag_consulta_dependencias_evidence'
const ROUTE_PATH = '/backend/v1/integracao/ac/diag-consulta-dependencias'
const BACKEND_VERSION = 'R13-2D2A-DIAG-CONSULTA-DEPENDENCIAS-BACKEND-20260812-v2'
const FRONTEND_VERSION = 'R13-2D2A-DIAG-CONSULTA-DEPENDENCIAS-FRONTEND-20260812-v2'
const CLASSIFICATION_WINDOW_START = '2026-08-11T20:38:39.900Z'
const CLASSIFICATION_WINDOW_END = '2026-08-11T20:38:40.000Z'
const DIAGNOSTIC_REFERENCE_TS = '2026-08-11T20:38:39.922Z'
const READ_ONLY = true
const BUTTON_ENABLED = true

function loadFromSession(): DependencyEvidence | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DependencyEvidence
    if (parsed && typeof parsed.raw_response === 'string') return parsed
    return null
  } catch {
    return null
  }
}

function saveToSession(data: DependencyEvidence) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
  } catch {
    /* ignore quota */
  }
}

export function DiagConsultaDependenciasBlock() {
  const [evidence, setEvidence] = useState<DependencyEvidence | null>(null)
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
        method: 'GET',
        headers: {
          Authorization: pb.authStore.token || '',
        },
      })

      const rawText = await res.text()

      const data: DependencyEvidence = {
        captured_from: 'HTTP_RESPONSE',
        http_status: res.status,
        captured_at: new Date().toISOString(),
        route: ROUTE_PATH,
        raw_response: rawText,
      }

      saveToSession(data)
      setEvidence(data)

      if (res.ok) {
        toast.success('Consulta de dependências executada — resposta HTTP capturada')
      } else {
        toast.warning(`Consulta retornou HTTP ${res.status} — resposta capturada`)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      const data: DependencyEvidence = {
        captured_from: 'FETCH_ERROR',
        http_status: 0,
        captured_at: new Date().toISOString(),
        route: ROUTE_PATH,
        raw_response: errorMessage,
      }
      saveToSession(data)
      setEvidence(data)
      toast.error('Erro de rede ao executar consulta de dependências')
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
    a.download = `diag-consulta-dependencias-${evidence.captured_at.replace(/[:.]/g, '-')}.json`
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
          <Link2 className="h-4 w-4" />
          Consulta de Dependências — Somente-Leitura
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
            <code className="text-foreground">GET {ROUTE_PATH}</code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">Fixed Filter:</span>
            <code className="text-foreground">execucao_id = "62otoics23ul0vy"</code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">Window Start:</span>
            <code className="text-foreground">{CLASSIFICATION_WINDOW_START}</code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">Window End:</span>
            <code className="text-foreground">{CLASSIFICATION_WINDOW_END}</code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">Diag Reference:</span>
            <code className="text-foreground">{DIAGNOSTIC_REFERENCE_TS}</code>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground mb-1">Estado da Consulta</div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">read_only:</span>
            <Badge variant={READ_ONLY ? 'default' : 'destructive'}>{String(READ_ONLY)}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">lock_state:</span>
            <Badge variant="secondary">armed</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">independent_lock:</span>
            <Badge variant="default">true</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">original_audit_lock:</span>
            <Badge variant="secondary">consumed (untouched)</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">query_executed:</span>
            <Badge variant={executedRef.current ? 'default' : 'outline'}>
              {String(executedRef.current)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">deletion_executed:</span>
            <Badge variant="outline">false</Badge>
          </div>
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
            Consultar dependências (somente-leitura)
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
              Nenhuma consulta de dependências executada. O botão "Consultar dependências
              (somente-leitura)" está habilitado. A rota é {`GET ${ROUTE_PATH}`}, utiliza filtro
              fixo server-side e possui lock independente (armed).
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              Bundle: {FRONTEND_VERSION} | Route: GET {ROUTE_PATH}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
