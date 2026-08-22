import { useState, useEffect, useRef } from 'react'
import { Play, Loader2, Lock, Copy, Download } from 'lucide-react'
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

interface RoundEvidenceData {
  rawText: string
  httpStatus: number
  correlationKey: string | null
  executedAt: string
}

interface RoundEvidenceBlockProps {
  roundLabel: string
  routePath: string
  sessionKey: string
  mode?: string
  description?: string
  disabled?: boolean
  onStart?: () => void
  onEnd?: () => void
}

function loadFromSession(key: string): RoundEvidenceData | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RoundEvidenceData
    if (parsed && typeof parsed.rawText === 'string') return parsed
    return null
  } catch {
    return null
  }
}

function saveToSession(key: string, data: RoundEvidenceData) {
  try {
    sessionStorage.setItem(key, JSON.stringify(data))
  } catch {
    /* ignore quota errors */
  }
}

export function RoundEvidenceBlock({
  roundLabel,
  routePath,
  sessionKey,
  mode = 'full',
  description,
  disabled = false,
  onStart,
  onEnd,
}: RoundEvidenceBlockProps) {
  const [evidence, setEvidence] = useState<RoundEvidenceData | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [executing, setExecuting] = useState(false)
  const executedRef = useRef(false)

  useEffect(() => {
    const saved = loadFromSession(sessionKey)
    if (saved) {
      setEvidence(saved)
      executedRef.current = true
    }
  }, [sessionKey])

  const handleExecute = async () => {
    if (executedRef.current || executing) return
    setExecuting(true)
    executedRef.current = true
    setDialogOpen(false)
    onStart?.()

    try {
      const res = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}${routePath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token || '',
        },
        body: JSON.stringify({ mode }),
      })

      const rawText = await res.text()
      const executedAt = new Date().toISOString()

      const data: RoundEvidenceData = {
        rawText,
        httpStatus: res.status,
        correlationKey: null,
        executedAt,
      }

      saveToSession(sessionKey, data)

      try {
        const parsed = JSON.parse(rawText) as { correlation_key?: string }
        if (parsed.correlation_key) {
          data.correlationKey = parsed.correlation_key
          saveToSession(sessionKey, data)
        }
      } catch {
        /* keep null if not parseable */
      }

      setEvidence(data)

      if (res.ok) {
        toast.success(`${roundLabel} Round executado — evidência capturada`)
      } else {
        toast.warning(`${roundLabel} Round retornou HTTP ${res.status} — evidência capturada`)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      const data: RoundEvidenceData = {
        rawText: JSON.stringify({ error: errorMessage }),
        httpStatus: 0,
        correlationKey: null,
        executedAt: new Date().toISOString(),
      }
      saveToSession(sessionKey, data)
      setEvidence(data)
      toast.error(`Erro de rede ao executar ${roundLabel} round`)
    } finally {
      setExecuting(false)
      onEnd?.()
    }
  }

  const handleCopy = async () => {
    if (!evidence) return
    try {
      await navigator.clipboard.writeText(evidence.rawText)
      toast.success('JSON bruto copiado')
    } catch {
      toast.error('Falha ao copiar')
    }
  }

  const handleDownload = () => {
    if (!evidence) return
    const blob = new Blob([evidence.rawText], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${roundLabel.toLowerCase()}-evidence-${evidence.executedAt.replace(/[:.]/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const defaultDescription = `Esta ação executará o round ${roundLabel} completo (security matrix + fluxo funcional) com dados sintéticos. O webhook será ativado temporariamente e restaurado ao final. A execução é única por sessão — após confirmar, o botão será bloqueado. Deseja continuar?`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-4 w-4" />
          Full Round ({roundLabel}) — Evidência Preservada
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                disabled={disabled || executedRef.current || executing}
                variant="default"
                size="sm"
              >
                {executing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : executedRef.current ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Full Round ({roundLabel})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar execução {roundLabel}</AlertDialogTitle>
                <AlertDialogDescription>{description || defaultDescription}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleExecute}>Confirmar e executar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {executedRef.current && (
            <Badge variant="secondary" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              Bloqueado para esta sessão
            </Badge>
          )}
        </div>

        {evidence && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge
                variant={
                  evidence.httpStatus >= 200 && evidence.httpStatus < 300
                    ? 'default'
                    : 'destructive'
                }
              >
                HTTP {evidence.httpStatus}
              </Badge>
              {evidence.correlationKey && (
                <Badge variant="outline" className="font-mono text-xs">
                  {evidence.correlationKey}
                </Badge>
              )}
              <span className="text-muted-foreground text-xs">
                {new Date(evidence.executedAt).toLocaleString('pt-BR')}
              </span>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCopy} variant="outline" size="sm">
                <Copy className="h-4 w-4 mr-1" />
                Copiar JSON bruto
              </Button>
              <Button onClick={handleDownload} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1" />
                Baixar JSON bruto
              </Button>
            </div>

            <div className="rounded-lg border bg-muted/50 p-3">
              <pre className="max-h-[600px] overflow-auto text-xs font-mono whitespace-pre-wrap break-all">
                {evidence.rawText}
              </pre>
            </div>
          </div>
        )}

        {!evidence && !executing && (
          <div className="text-sm text-muted-foreground">
            Nenhuma evidência {roundLabel} capturada. Clique em "Full Round ({roundLabel})" e
            confirme para executar.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
