import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, RefreshCw, SearchX, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  decidirQualificacao,
  listarQualificacoesPendentes,
  mapQualificacaoError,
  novaChaveQualificacao,
  type QualificacaoPendente,
} from '@/services/qualificacoes'

type Decisao = 'qualificada' | 'desqualificada'

export default function Qualificacoes() {
  const [itens, setItens] = useState<QualificacaoPendente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selecionado, setSelecionado] = useState<QualificacaoPendente | null>(null)
  const [decisao, setDecisao] = useState<Decisao>('qualificada')
  const [motivo, setMotivo] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const response = await listarQualificacoesPendentes()
      setItens(response.itens)
    } catch (_) {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const abrir = (item: QualificacaoPendente, novaDecisao: Decisao) => {
    setSelecionado(item)
    setDecisao(novaDecisao)
    setMotivo('')
    setJustificativa('')
  }

  const confirmar = async () => {
    if (!selecionado || (decisao === 'desqualificada' && !motivo.trim())) return
    setSalvando(true)
    try {
      await decidirQualificacao({
        negocio_id: selecionado.id,
        decisao,
        motivo: motivo.trim() || null,
        justificativa: justificativa.trim() || null,
        updated_esperado: selecionado.updated,
        command_idempotency_key: novaChaveQualificacao(selecionado.id),
      })
      setItens((atuais) => atuais.filter((item) => item.id !== selecionado.id))
      setSelecionado(null)
      toast.success(
        decisao === 'qualificada' ? 'Prospect qualificado.' : 'Prospect desqualificado.',
      )
    } catch (err) {
      toast.error(mapQualificacaoError(err))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Qualificação</h1>
          <p className="text-sm text-muted-foreground">Prospects aguardando decisão explícita</p>
        </div>
        <Button
          variant="outline"
          onClick={() => void carregar()}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Falha ao carregar</AlertTitle>
          <AlertDescription>Atualize a lista para tentar novamente.</AlertDescription>
        </Alert>
      )}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-48 w-full" />
          ))}
        </div>
      ) : itens.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <SearchX className="h-9 w-9 text-muted-foreground" />
            <div>
              <p className="font-semibold">Nenhum prospect pendente</p>
              <p className="text-sm text-muted-foreground">A fila de qualificação está em dia.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {itens.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{item.titulo}</CardTitle>
                    <CardDescription>
                      {item.empresa?.nome ?? 'Empresa não informada'}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">Pendente</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="line-clamp-3 text-sm text-muted-foreground">
                  {item.descricao || 'Necessidade ainda sem descrição.'}
                </p>
                <div className="text-xs text-muted-foreground">
                  <span>Origem: {item.origem_canal || 'não informada'}</span>
                  <span className="mx-2">•</span>
                  <span>Responsável: {item.responsavel?.nome || 'não informado'}</span>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 gap-2" onClick={() => abrir(item, 'qualificada')}>
                    <CheckCircle2 className="h-4 w-4" />
                    Qualificar
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 text-rose-700"
                    onClick={() => abrir(item, 'desqualificada')}
                  >
                    <XCircle className="h-4 w-4" />
                    Desqualificar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={!!selecionado}
        onOpenChange={(open) => !open && !salvando && setSelecionado(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisao === 'qualificada' ? 'Confirmar qualificação' : 'Confirmar desqualificação'}
            </DialogTitle>
            <DialogDescription>
              {selecionado?.titulo}. A decisão será registrada com autor, data e histórico
              permanente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {decisao === 'desqualificada' && (
              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo *</Label>
                <Textarea
                  id="motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  maxLength={500}
                  placeholder="Informe por que o prospect não será qualificado"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="justificativa">Observação</Label>
              <Textarea
                id="justificativa"
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                maxLength={1000}
                placeholder="Contexto adicional, se necessário"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelecionado(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              onClick={() => void confirmar()}
              disabled={salvando || (decisao === 'desqualificada' && !motivo.trim())}
            >
              {salvando ? 'Registrando…' : 'Confirmar decisão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
