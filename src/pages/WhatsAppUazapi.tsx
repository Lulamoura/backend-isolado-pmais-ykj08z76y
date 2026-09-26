import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { obterStatusWhatsAppUazapi, type WhatsAppUazapiResumo } from '@/services/whatsapp-uazapi'

function formatarValor(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Não informado'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  return String(value)
}

function ResumoTecnico({ titulo, dados }: { titulo: string; dados?: Record<string, unknown> | null }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-slate-900">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-slate-700">
        {!dados ? (
          <p className="text-slate-500">Ainda sem registro.</p>
        ) : (
          Object.entries(dados)
            .filter(([key]) => !['id', 'created'].includes(key))
            .map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4 border-b border-slate-100 pb-1 last:border-0">
                <span className="text-slate-500">{key.replace(/_/g, ' ')}</span>
                <span className="text-right font-medium text-slate-900">{formatarValor(value)}</span>
              </div>
            ))
        )}
      </CardContent>
    </Card>
  )
}

export default function WhatsAppUazapi() {
  const [status, setStatus] = useState<WhatsAppUazapiResumo | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    setLoading(true)
    setErro(null)
    try {
      setStatus(await obterStatusWhatsAppUazapi())
    } catch (_) {
      setErro('Não foi possível carregar o monitoramento do WhatsApp agora.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [])

  const counts = status?.counts

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-700">WhatsApp Comercial</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">Monitoramento WhatsApp</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Painel mínimo da fase Uazapi para acompanhar captura passiva, mídias pendentes,
            transcrições e preparação do vínculo com contato, empresa e negócio.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void carregar()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Atualizar
        </Button>
      </div>

      <Alert className="border-amber-200 bg-amber-50 text-amber-950">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Sem envio automático</AlertTitle>
        <AlertDescription>
          Esta etapa é somente captura, normalização e homologação. O Nexo ainda não responde clientes
          e nenhuma mensagem é enviada pelo sistema.
        </AlertDescription>
      </Alert>

      {erro && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Falha de monitoramento</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Eventos hoje</CardDescription>
            <CardTitle className="text-3xl">{loading ? '...' : counts?.eventos_24h ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Mensagens hoje</CardDescription>
            <CardTitle className="text-3xl">{loading ? '...' : counts?.mensagens_24h ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Mídias pendentes</CardDescription>
            <CardTitle className="text-3xl">{loading ? '...' : counts?.midias_pendentes ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Transcrições pendentes</CardDescription>
            <CardTitle className="text-3xl">
              {loading ? '...' : counts?.transcricoes_pendentes ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Vínculos pendentes</CardDescription>
            <CardTitle className="text-3xl">{loading ? '...' : counts?.vinculos_pendentes ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ResumoTecnico titulo="Último webhook" dados={status?.ultimo_webhook} />
        <ResumoTecnico titulo="Última mensagem" dados={status?.ultima_mensagem} />
        <ResumoTecnico titulo="Última mídia" dados={status?.ultima_midia} />
      </section>

      <Card className="border-blue-100 bg-blue-50/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-950">
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
            Próximas etapas desta fase
          </CardTitle>
          <CardDescription>
            Itens que podem avançar mesmo sem os aparelhos da equipe neste sábado.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(status?.proximas_etapas || [
            'simulacao_controlada',
            'worker_midia_transcricao',
            'painel_monitoramento_minimo',
            'vinculo_negocio_pendente',
          ]).map((etapa) => (
            <Badge key={etapa} variant="secondary" className="bg-white text-blue-900">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              {etapa.replace(/_/g, ' ')}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </main>
  )
}
