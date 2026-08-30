import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { changeProvelo, getProveloStatus, type ProveloStatus } from '@/services/provelo'
export function ProveloIntegrationCard() {
  const [status, setStatus] = useState<ProveloStatus | null>(null),
    [url, setUrl] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  useEffect(() => {
    getProveloStatus()
      .then(setStatus)
      .catch(() => setError('Não foi possível consultar a integração.'))
  }, [])
  const act = async (body: Record<string, string>) => {
    setBusy(true)
    setError('')
    try {
      setStatus(await changeProvelo(body))
      setUrl('')
    } catch {
      setError('A alteração não foi confirmada pelo servidor.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Integração Provelo</CardTitle>
          <Badge variant={status?.enabled ? 'default' : 'secondary'}>
            {status?.enabled ? 'Ativa' : 'Desativada'}
          </Badge>
        </div>
        <CardDescription>Cria rascunhos pela ponte oficial Make/Provelo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm space-y-1">
          <p>Destino configurado: {status?.configured ? 'Sim' : 'Não'}</p>
          <p>Impressão digital: {status?.fingerprint || '—'}</p>
          <p>A URL vigente nunca é exibida.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="password"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Nova URL Make/Provelo"
            autoComplete="off"
          />
          <Button
            variant="outline"
            disabled={busy || !url}
            onClick={() =>
              act({ action: 'replace_url', url, confirmation: 'SUBSTITUIR URL PROVELO' })
            }
          >
            Substituir URL
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            disabled={busy || !status?.configured || status?.enabled}
            onClick={() => act({ action: 'enable', confirmation: 'ATIVAR INTEGRACAO PROVELO' })}
          >
            Ativar integração
          </Button>
          <Button
            variant="outline"
            disabled={busy || !status?.enabled}
            onClick={() => act({ action: 'disable', confirmation: 'DESATIVAR INTEGRACAO PROVELO' })}
          >
            Desativar integração
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
