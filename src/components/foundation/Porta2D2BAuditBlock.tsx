import { useState } from 'react'
import {
  Play,
  Loader2,
  Lock,
  Copy,
  Download,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { captureAuditRound2D2B } from '@/services/audit-round-2d2b'

/**
 * Porta 2D.2B — Auditoria (captura manual somente-leitura).
 *
 * Utiliza exclusivamente `captureAuditRound2D2B()` de
 * src/services/audit-round-2d2b.ts, que executa uma única GET autenticada
 * (fetch nativo + token do authStore do PocketBase SDK) contra
 * /backend/v1/integracao/ac/audit-round-2d2b e captura o status HTTP REAL
 * (response.status) e o corpo bruto REAL (response.text()) — sem fixar 200 e
 * sem reconstruir o corpo via JSON.stringify. Nenhuma chamada automática em
 * montagem, renderização ou atualização. A execução ocorre SOMENTE após clique
 * humano no botão e confirmação no diálogo. No máximo uma chamada GET por clique
 * confirmado. Sem retry, polling ou chamada em segundo plano.
 */

const ROUTE_PATH = '/backend/v1/integracao/ac/audit-round-2d2b'
const ROUTE_METHOD = 'GET'
const LOCALSTORAGE_KEY = 'porta-2d2b-last-audit'
const FRONTEND_VERSION = 'R13-2D2B-AUDIT-CAPTURE-FRONTEND-20260813-v2-0.0.134'

interface AuditCapture {
  executed: boolean
  captured_at: string
  route: string
  method: string
  http_status: number
  ok: boolean
  raw_body: string
  error_message: string | null
}

function emptyCapture(): AuditCapture {
  return {
    executed: false,
    captured_at: '',
    route: `GET ${ROUTE_PATH}`,
    method: ROUTE_METHOD,
    http_status: 0,
    ok: false,
    raw_body: '',
    error_message: null,
  }
}

function loadFromStorage(): AuditCapture | null {
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuditCapture
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.raw_body !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

function saveToStorage(data: AuditCapture) {
  try {
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(data))
  } catch {
    /* ignore quota */
  }
}

/** Sanitiza o erro de rede: expõe apenas message, sem tokens ou headers. */
function sanitizeError(err: unknown): { message: string } {
  const message = err instanceof Error ? err.message : 'Erro desconhecido'
  return { message }
}

/** Extrai mensagem estruturada do parsedBody (se houver) sem substituir rawBody. */
function extrairMensagemErro(parsedBody: unknown): string | null {
  if (!parsedBody || typeof parsedBody !== 'object') return null
  try {
    const obj = parsedBody as { message?: unknown; error?: unknown }
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.error === 'string') return obj.error
    if (obj.message && typeof obj.message === 'object') {
      return JSON.stringify(obj.message)
    }
  } catch {
    /* ignore */
  }
  return null
}

export function Porta2D2BAuditBlock() {
  const [capture, setCapture] = useState<AuditCapture>(() => loadFromStorage() ?? emptyCapture())
  const [executing, setExecuting] = useState(false)

  // Executa SOMENTE após confirmação humana no diálogo. Sem chamada automática.
  const handleConfirmExecute = async () => {
    if (executing) return // bloqueia duplicação
    setExecuting(true)

    const captured_at = new Date().toISOString()

    try {
      const { httpStatus, rawBody, parsedBody } = await captureAuditRound2D2B()
      const ok = httpStatus >= 200 && httpStatus < 300
      const next: AuditCapture = {
        executed: true,
        captured_at,
        route: `GET ${ROUTE_PATH}`,
        method: ROUTE_METHOD,
        http_status: httpStatus,
        ok,
        raw_body: rawBody,
        error_message: ok ? null : extrairMensagemErro(parsedBody),
      }
      saveToStorage(next)
      setCapture(next)
      if (ok) {
        toast.success('Auditoria somente-leitura executada — resposta capturada')
      } else {
        toast.error(`Auditoria retornou HTTP ${httpStatus} — resposta capturada`)
      }
    } catch (err) {
      const { message } = sanitizeError(err)
      const next: AuditCapture = {
        executed: true,
        captured_at,
        route: `GET ${ROUTE_PATH}`,
        method: ROUTE_METHOD,
        http_status: 0,
        ok: false,
        raw_body: message,
        error_message: message,
      }
      saveToStorage(next)
      setCapture(next)
      toast.error('Erro de rede ao executar auditoria — erro capturado')
    } finally {
      setExecuting(false)
    }
  }

  const handleCopy = async () => {
    if (!capture.executed || !capture.raw_body) return
    try {
      await navigator.clipboard.writeText(capture.raw_body)
      toast.success('JSON copiado para a área de transferência')
    } catch {
      toast.error('Falha ao copiar JSON')
    }
  }

  const handleDownload = () => {
    if (!capture.executed || !capture.raw_body) return
    const blob = new Blob([capture.raw_body], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `porta-2d2b-audit-${capture.captured_at.replace(/[:.]/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleClear = () => {
    try {
      localStorage.removeItem(LOCALSTORAGE_KEY)
    } catch {
      /* ignore */
    }
    setCapture(emptyCapture())
    toast.info('Captura local removida (nenhum dado do backend foi alterado)')
  }

  const buttonDisabled = executing
  const hasCapture = capture.executed && !!capture.raw_body

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Porta 2D.2B — Auditoria
          </CardTitle>
          <CardDescription>
            Captura manual da rota read-only{' '}
            <code className="text-xs">GET /backend/v1/integracao/ac/audit-round-2d2b</code>. A
            execução é disparada exclusivamente por clique humano no botão, após confirmação.
            Nenhuma chamada automática, retry, polling ou execução em segundo plano. A resposta real
            é preservada integralmente (status HTTP, timestamp e corpo JSON bruto) e persistida
            client-side em <code className="text-xs">localStorage</code> para sobreviver a re-render
            e reload — sem nenhuma escrita no backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Estado inicial / alvo */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground mb-1">Alvo da Captura</div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
              <span className="text-muted-foreground">Rota alvo:</span>
              <code className="text-foreground">GET {ROUTE_PATH}</code>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
              <span className="text-muted-foreground">Método:</span>
              <code className="text-foreground">{ROUTE_METHOD}</code>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
              <span className="text-muted-foreground">Frontend:</span>
              <code className="text-foreground">{FRONTEND_VERSION}</code>
            </div>
          </div>

          {/* Avisos */}
          <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
              <ShieldCheck className="h-4 w-4" />
              Somente-leitura
            </div>
            <div className="text-xs text-amber-800 dark:text-amber-300">
              Esta captura não realiza nenhuma escrita no backend, nem dispara webhook, rollback,
              ActiveCampaign ou qualquer chamada externa.
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300 mt-2">
              <ShieldAlert className="h-4 w-4" />
              Não executar sem autorização expressa
            </div>
            <div className="text-xs text-amber-800 dark:text-amber-300">
              A execução é read-only, mas deve ser autorizada explicitamente antes de cada clique.
            </div>
          </div>

          {/* Estado da auditoria */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Estado da Auditoria
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
              <span className="text-muted-foreground">executed:</span>
              <Badge variant={capture.executed ? 'default' : 'outline'}>
                {String(capture.executed)}
              </Badge>
            </div>
            {!capture.executed && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
                <span className="text-muted-foreground">evidence:</span>
                <Badge variant="outline">Nenhuma evidência capturada</Badge>
              </div>
            )}
            {capture.executed && (
              <>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
                  <span className="text-muted-foreground">captured_at:</span>
                  <code className="text-foreground">{capture.captured_at}</code>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
                  <span className="text-muted-foreground">http_status:</span>
                  <Badge variant={capture.ok ? 'default' : 'destructive'}>
                    {capture.http_status > 0 ? `HTTP ${capture.http_status}` : 'n/a'}
                  </Badge>
                </div>
              </>
            )}
          </div>

          {/* Ação: diálogo de confirmação */}
          <div className="flex flex-wrap items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={buttonDisabled} variant="default" size="sm">
                  {executing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : capture.executed ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Executar auditoria somente-leitura
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar auditoria somente-leitura?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Nenhuma escrita será realizada. Será executada uma única chamada GET para{' '}
                    <code className="text-xs">{ROUTE_PATH}</code>. A resposta real será preservada e
                    exibida na tela. Confirma a execução?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={executing}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={executing}
                    onClick={(e) => {
                      e.preventDefault()
                      void handleConfirmExecute()
                    }}
                  >
                    {executing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Executando...
                      </>
                    ) : (
                      'Confirmar e executar GET'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {executing && (
              <Badge variant="secondary" className="text-xs">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Requisição em andamento
              </Badge>
            )}
          </div>

          {/* Ações de cópia/download */}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleCopy} variant="outline" size="sm" disabled={!hasCapture}>
              <Copy className="h-4 w-4 mr-1" />
              Copiar JSON
            </Button>
            <Button onClick={handleDownload} variant="outline" size="sm" disabled={!hasCapture}>
              <Download className="h-4 w-4 mr-1" />
              Baixar JSON
            </Button>
            {hasCapture && (
              <Button onClick={handleClear} variant="ghost" size="sm">
                Limpar captura local
              </Button>
            )}
          </div>

          {/* Exibição da resposta */}
          {capture.executed && capture.raw_body ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant={capture.ok ? 'default' : 'destructive'}>
                  {capture.ok ? 'HTTP_RESPONSE' : 'CAPTURE_ERROR'}
                </Badge>
                {capture.http_status > 0 && (
                  <Badge variant={capture.ok ? 'default' : 'destructive'}>
                    HTTP {capture.http_status}
                  </Badge>
                )}
                <span className="text-muted-foreground text-xs">
                  {capture.captured_at ? new Date(capture.captured_at).toLocaleString('pt-BR') : ''}
                </span>
              </div>

              {!capture.ok && capture.error_message && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                  <div className="text-xs text-destructive">
                    <div className="font-medium">Erro sanitizado</div>
                    <div className="font-mono break-all">{capture.error_message}</div>
                    <div className="mt-1 text-muted-foreground">
                      Exibido apenas message e status — tokens e headers foram omitidos.
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg border bg-muted/50 p-3">
                <pre className="max-h-[600px] overflow-auto text-xs font-mono whitespace-pre-wrap break-all">
                  {capture.raw_body}
                </pre>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">
                executed: false — Nenhuma evidência capturada. A rota alvo é{' '}
                <code className="text-xs">GET {ROUTE_PATH}</code> (somente-leitura). A execução
                ocorre somente após clicar no botão e confirmar o diálogo.
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                Bundle: {FRONTEND_VERSION} | Route: GET {ROUTE_PATH}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
