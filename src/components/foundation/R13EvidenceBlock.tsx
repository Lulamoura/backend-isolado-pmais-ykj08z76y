import { useState, useEffect, useRef } from 'react'
import { Play, Loader2, Lock, Copy, Download, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'

interface R13Evidence {
  captured_from: 'HTTP_RESPONSE' | 'FETCH_ERROR'
  http_status: number
  captured_at: string
  route: string
  raw_response: string
}

const SESSION_KEY = 'ac_r13_evidence'
const ROUTE_PATH = '/backend/v1/integracao/ac/run-round-2d2a-r13'
const BACKEND_VERSION = 'R13-GATE-20260812-v1'
const FRONTEND_BUNDLE = 'R13-UI-20260812-v3'
const EXECUTION_ENABLED = true
const SERVER_SIDE_LOCK = 'armed'

function loadFromSession(): R13Evidence | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as R13Evidence
    if (parsed && typeof parsed.raw_response === 'string') return parsed
    return null
  } catch {
    return null
  }
}

function saveToSession(data: R13Evidence) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
  } catch {
    /* ignore quota */
  }
}

export function R13EvidenceBlock() {
  const [evidence, setEvidence] = useState<R13Evidence | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
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
    setDialogOpen(false)

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

      const data: R13Evidence = {
        captured_from: 'HTTP_RESPONSE',
        http_status: res.status,
        captured_at: new Date().toISOString(),
        route: ROUTE_PATH,
        raw_response: rawText,
      }

      saveToSession(data)
      setEvidence(data)

      if (res.ok) {
        toast.success('R13 Round executado — resposta HTTP capturada')
      } else {
        toast.warning(`R13 Round retornou HTTP ${res.status} — resposta capturada`)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      const data: R13Evidence = {
        captured_from: 'FETCH_ERROR',
        http_status: 0,
        captured_at: new Date().toISOString(),
        route: ROUTE_PATH,
        raw_response: errorMessage,
      }
      saveToSession(data)
      setEvidence(data)
      toast.error('Erro de rede ao executar R13 round')
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
    a.download = `r13-http-response-${evidence.captured_at.replace(/[:.]/g, '-')}.json`
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
          <Lock className="h-4 w-4" />
          Full Round (R13) — Controle de Execução
          <Badge variant="outline" className="ml-auto text-xs font-mono">
            {FRONTEND_BUNDLE}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">Route:</span>
            <code className="text-foreground">{ROUTE_PATH}</code>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
            <span className="text-muted-foreground">Backend:</span>
            <code className="text-foreground">{BACKEND_VERSION}</code>
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
          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button disabled={buttonDisabled} variant="default" size="sm">
                {executing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : executedRef.current ? (
                  <Lock className="h-4 w-4" />
                ) : !EXECUTION_ENABLED ? (
                  <ShieldOff className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Full Round (R13)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar execução R13</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação executará o round R13 completo (security matrix + fluxo funcional) com
                  dados sintéticos. O webhook será ativado temporariamente e restaurado ao final. A
                  execução é única por sessão — após confirmar, o botão será bloqueado. Deseja
                  continuar?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleExecute}>Confirmar e executar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {!EXECUTION_ENABLED && (
            <Badge variant="destructive" className="text-xs">
              <ShieldOff className="h-3 w-3 mr-1" />
              Execução desativada
            </Badge>
          )}

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
            Copiar JSON bruto
          </Button>
          <Button onClick={handleDownload} variant="outline" size="sm" disabled={!canCopyDownload}>
            <Download className="h-4 w-4 mr-1" />
            Baixar JSON bruto
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
              Nenhuma evidência R13 capturada. O botão "Full Round (R13)" está desativado — a
              execução será disponibilizada em uma versão futura.
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
