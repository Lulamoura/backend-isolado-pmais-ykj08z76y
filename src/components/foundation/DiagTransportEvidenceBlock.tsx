import { useState, useEffect, useRef } from 'react'
import { Play, Loader2, Lock, Copy, Download, ShieldOff, Server } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'

interface DiagTransportEvidence {
  captured_from: 'HTTP_RESPONSE' | 'FETCH_ERROR'
  http_status: number
  captured_at: string
  route: string
  raw_response: string
  response_headers: Record<string, string>
  content_type: string
}

const SESSION_KEY = 'ac_diag_transport_evidence'
const ROUTE_PATH = '/backend/v1/integracao/ac/diag-transport'
const DIAGNOSTIC_VERSION = 'R13-DIAG-TRANSPORTE-20260812-v1'
const FRONTEND_BUNDLE = 'R13-DIAG-TRANSPORTE-FRONTEND-GATESYNC-20260812-v1'
const EXECUTION_ENABLED = true
const SERVER_SIDE_LOCK = 'armed'
const NOMINAL_VARIANTS = [
  '1_valid_signature_current_transport',
  '2_invalid_signature_current_transport',
  '3_missing_signature_current_transport',
  '4_missing_signature_json_string_body',
  '5_missing_signature_bytes_body',
  '6_missing_signature_explicit_content_length',
  '7_missing_signature_second_http_primitive',
] as const

function loadFromSession(): DiagTransportEvidence | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DiagTransportEvidence
    if (parsed && typeof parsed.raw_response === 'string') return parsed
    return null
  } catch {
    return null
  }
}

function saveToSession(data: DiagTransportEvidence) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
  } catch {
    /* ignore quota */
  }
}

export function DiagTransportEvidenceBlock() {
  const [evidence, setEvidence] = useState<DiagTransportEvidence | null>(null)
  const [executing, setExecuting] = useState(false)
  const executedRef = useRef(false)

  useEffect(() => {
    const saved = loadFromSession()
    if (saved) {
      setEvidence(saved)
      executedRef.current = true
    }
  }, [])

  const handleExecute = async () => {
    if (executedRef.current || executing || !EXECUTION_ENABLED) return
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
        body: JSON.stringify({ mode: 'full' }),
      })

      const rawText = await res.text()
      const responseHeaders: Record<string, string> = {}
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      const data: DiagTransportEvidence = {
        captured_from: 'HTTP_RESPONSE',
        http_status: res.status,
        captured_at: new Date().toISOString(),
        route: ROUTE_PATH,
        raw_response: rawText,
        response_headers: responseHeaders,
        content_type: res.headers.get('content-type') || '',
      }

      saveToSession(data)
      setEvidence(data)

      if (res.ok) {
        toast.success('Diagnóstico de transporte executado — resposta HTTP capturada')
      } else {
        toast.warning(`Diagnóstico retornou HTTP ${res.status} — resposta capturada`)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      const data: DiagTransportEvidence = {
        captured_from: 'FETCH_ERROR',
        http_status: 0,
        captured_at: new Date().toISOString(),
        route: ROUTE_PATH,
        raw_response: errorMessage,
        response_headers: {},
        content_type: '',
      }
      saveToSession(data)
      setEvidence(data)
      toast.error('Erro de rede ao executar diagnóstico de transporte')
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
    a.download = `diag-transport-response-${evidence.captured_at.replace(/[:.]/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const canCopyDownload =
    !!evidence && evidence.captured_from === 'HTTP_RESPONSE' && !!evidence.raw_response

  const buttonDisabled = !EXECUTION_ENABLED || executedRef.current || executing

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-4 w-4" />
          Diagnóstico de Transporte — Controle Independente
          <Badge variant="outline" className="ml-auto text-xs font-mono">
            {FRONTEND_BUNDLE}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">Diagnostic Version:</span>
            <code className="text-foreground">{DIAGNOSTIC_VERSION}</code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">Route:</span>
            <code className="text-foreground">{ROUTE_PATH}</code>
          </div>
        </div>

        <div className="rounded-lg border p-3 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Variantes Nominais</div>
          <div className="space-y-1">
            {NOMINAL_VARIANTS.map((variant) => (
              <div key={variant} className="flex items-center gap-2 text-xs font-mono">
                <Badge variant="outline" className="text-xs">
                  {variant.split('_')[0]}
                </Badge>
                <code className="text-foreground">{variant}</code>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground mb-1">
            Estado do Diagnóstico
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">execution_enabled:</span>
            <Badge variant={EXECUTION_ENABLED ? 'default' : 'destructive'}>
              {String(EXECUTION_ENABLED)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">server_side_lock:</span>
            <Badge variant="secondary">{SERVER_SIDE_LOCK}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">executed:</span>
            <Badge variant={executedRef.current ? 'default' : 'outline'}>
              {String(executedRef.current)}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={buttonDisabled} variant="default" size="sm" onClick={handleExecute}>
            {executing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : !EXECUTION_ENABLED ? (
              <ShieldOff className="h-4 w-4" />
            ) : executedRef.current ? (
              <Lock className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Executar diagnóstico de transporte
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
              {evidence.content_type && (
                <Badge variant="outline" className="text-xs font-mono">
                  {evidence.content_type}
                </Badge>
              )}
              <span className="text-muted-foreground text-xs">
                {new Date(evidence.captured_at).toLocaleString('pt-BR')}
              </span>
            </div>

            {Object.keys(evidence.response_headers).length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Response Headers
                </div>
                {Object.entries(evidence.response_headers).map(([key, val]) => (
                  <div key={key} className="text-xs font-mono">
                    <span className="text-muted-foreground">{key}:</span>{' '}
                    <span className="text-foreground">{val}</span>
                  </div>
                ))}
              </div>
            )}

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
              Nenhuma evidência de diagnóstico de transporte capturada. O botão "Executar
              diagnóstico de transporte" está habilitado — clique para iniciar a execução única e
              exclusiva.
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              Bundle: {FRONTEND_BUNDLE} | Route: POST {ROUTE_PATH}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
