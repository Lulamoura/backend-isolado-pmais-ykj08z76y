import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BusinessNotesDialog } from '@/components/BusinessNotesDialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  listarFilaAtividades,
  mapAtividadeError,
  novaChaveAtividade,
  registrarAtividade,
  type CanalAtividade,
  type ItemFilaAtividade,
  type SituacaoAtividade,
  type TipoAtividade,
} from '@/services/atividades'

type Operacao = 'planejar' | 'realizar' | 'cancelar'

const TIPOS: Array<{ value: TipoAtividade; label: string }> = [
  { value: 'tentativa_contato', label: 'Tentativa de contato' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'visita', label: 'Visita' },
  { value: 'envio_proposta', label: 'Envio de proposta' },
  { value: 'acompanhamento_proposta', label: 'Acompanhamento de proposta' },
  { value: 'aceite_verbal_pendente', label: 'Aceite verbal pendente' },
  { value: 'decisao_combinada', label: 'Decisão combinada' },
  { value: 'tarefa_interna', label: 'Tarefa interna' },
]
const CANAIS: Array<{ value: CanalAtividade; label: string }> = [
  { value: 'telefone', label: 'Telefone' },
  { value: 'email', label: 'E-mail' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'presencial', label: 'Presencial' },
  { value: 'video', label: 'Vídeo' },
]

const rotuloSituacao: Record<SituacaoAtividade, string> = {
  sem_proxima_acao: 'Sem próxima ação',
  vencida: 'Ação vencida',
  programada: 'Programada',
}

const classeSituacao: Record<SituacaoAtividade, string> = {
  sem_proxima_acao: 'border-l-4 border-l-amber-500 bg-amber-50/70',
  vencida: 'border-l-4 border-l-rose-600 bg-rose-50/70',
  programada: 'border-l-4 border-l-emerald-600 bg-emerald-50/70',
}

function rotuloModalidade(value: string | null) {
  if (value === 'recorrente') return 'Recorrente'
  if (value === 'evento') return 'Evento'
  if (value === 'serv_eventual') return 'Serviço eventual'
  return 'Não informada'
}

function dataLocal(value: string | null) {
  if (!value) return 'Sem data definida'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  )
}

export default function Atividades() {
  const [searchParams] = useSearchParams()
  const escopoDia = searchParams.get('escopo') === 'dia'
  const [itens, setItens] = useState<ItemFilaAtividade[]>([])
  const [filtro, setFiltro] = useState<SituacaoAtividade | 'todas'>('todas')
  const [loading, setLoading] = useState(true)
  const [selecionado, setSelecionado] = useState<ItemFilaAtividade | null>(null)
  const [operacao, setOperacao] = useState<Operacao>('planejar')
  const [tipo, setTipo] = useState<TipoAtividade>('tentativa_contato')
  const [canal, setCanal] = useState<CanalAtividade | ''>('')
  const [data, setData] = useState('')
  const [descricao, setDescricao] = useState('')
  const [resultado, setResultado] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const response = await listarFilaAtividades(filtro, escopoDia ? 'dia' : 'todas')
      setItens(response.itens)
    } catch (_) {
      toast.error('Não foi possível carregar a fila de próximas ações.')
    } finally {
      setLoading(false)
    }
  }, [escopoDia, filtro])

  useEffect(() => void carregar(), [carregar])

  const totais = useMemo(
    () => ({
      sem: itens.filter((i) => i.situacao === 'sem_proxima_acao').length,
      vencidas: itens.filter((i) => i.situacao === 'vencida').length,
      programadas: itens.filter((i) => i.situacao === 'programada').length,
    }),
    [itens],
  )

  const abrir = (item: ItemFilaAtividade, op: Operacao) => {
    setSelecionado(item)
    setOperacao(op)
    setTipo('tentativa_contato')
    setCanal(item.proxima_acao?.canal ?? '')
    setData('')
    setDescricao('')
    setResultado('')
    setJustificativa('')
  }

  const confirmar = async () => {
    if (!selecionado) return
    const acao = selecionado.proxima_acao
    setSalvando(true)
    try {
      if (operacao === 'planejar') {
        if (!data || !selecionado.negocio.responsavel) return
        await registrarAtividade({
          operacao,
          negocio_id: selecionado.negocio.id,
          tipo,
          descricao: descricao.trim() || null,
          responsavel_id: selecionado.negocio.responsavel.id,
          canal: canal || null,
          planejada_para: new Date(data).toISOString(),
          updated_esperado: selecionado.negocio.updated,
          command_idempotency_key: novaChaveAtividade(selecionado.negocio.id),
        })
      } else {
        if (!acao) return
        await registrarAtividade({
          operacao,
          atividade_id: acao.id,
          canal: canal || null,
          resultado: resultado.trim() || null,
          justificativa_cancelamento: justificativa.trim() || null,
          updated_esperado: acao.updated,
          command_idempotency_key: novaChaveAtividade(acao.id),
        })
      }
      toast.success(
        operacao === 'planejar'
          ? 'Próxima ação planejada.'
          : operacao === 'realizar'
            ? 'Atividade concluída.'
            : 'Atividade cancelada.',
      )
      setSelecionado(null)
      await carregar()
    } catch (err) {
      toast.error(mapAtividadeError(err))
    } finally {
      setSalvando(false)
    }
  }

  const confirmarDesabilitado =
    salvando ||
    (operacao === 'planejar' && (!data || !selecionado?.negocio.responsavel)) ||
    (operacao === 'realizar' && !resultado.trim()) ||
    (operacao === 'cancelar' && !justificativa.trim())

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {escopoDia ? 'Ações do Dia' : 'Atividades e próxima ação'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {escopoDia
              ? 'Sem data, vencidas e previstas para hoje, em ordem de urgência'
              : 'Fila acionável dos negócios abertos'}
          </p>
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

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-2xl font-bold">{totais.sem}</p>
              <p className="text-xs text-muted-foreground">Sem próxima ação</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock3 className="h-5 w-5 text-rose-600" />
            <div>
              <p className="text-2xl font-bold">{totais.vencidas}</p>
              <p className="text-xs text-muted-foreground">Ações vencidas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CalendarClock className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-2xl font-bold">{totais.programadas}</p>
              <p className="text-xs text-muted-foreground">
                {escopoDia ? 'Ações para hoje' : 'Programadas'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Filtros da fila">
        {(['todas', 'sem_proxima_acao', 'vencida', 'programada'] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={filtro === value ? 'default' : 'outline'}
            onClick={() => setFiltro(value)}
          >
            {value === 'todas' ? 'Todas' : rotuloSituacao[value]}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-52" />
          ))}
        </div>
      ) : itens.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <p className="font-semibold">Nenhum negócio nesta situação</p>
            <p className="text-sm text-muted-foreground">A fila selecionada está em dia.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {itens.map((item) => (
            <Card key={item.negocio.id} className={classeSituacao[item.situacao]}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{item.negocio.titulo}</CardTitle>
                    <CardDescription>
                      {item.negocio.external_id ? `Negócio AC #${item.negocio.external_id} · ` : ''}
                      {item.negocio.empresa?.nome || 'Empresa não informada'} ·{' '}
                      {item.negocio.etapa || 'Etapa não informada'}
                    </CardDescription>
                  </div>
                  <Badge variant={item.situacao === 'programada' ? 'secondary' : 'destructive'}>
                    {rotuloSituacao[item.situacao]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {item.proxima_acao ? (
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <p className="font-medium">
                      {TIPOS.find((t) => t.value === item.proxima_acao?.tipo)?.label}
                    </p>
                    <p className="text-muted-foreground">
                      {dataLocal(item.proxima_acao.planejada_para)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Responsável: {item.proxima_acao.responsavel?.nome || 'não informado'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Modalidade: {rotuloModalidade(item.negocio.modalidade)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-amber-700">
                    Este negócio aberto precisa de uma próxima ação.
                  </p>
                )}
                {item.proxima_acao?.editavel ? (
                  <div className="flex gap-2">
                    <Button className="flex-1 gap-2" onClick={() => abrir(item, 'realizar')}>
                      <CheckCircle2 className="h-4 w-4" />
                      Concluir
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => abrir(item, 'cancelar')}
                    >
                      <XCircle className="h-4 w-4" />
                      Cancelar
                    </Button>
                  </div>
                ) : item.proxima_acao ? (
                  <p className="text-xs text-muted-foreground">
                    Atualize esta ação no ActiveCampaign.
                  </p>
                ) : (
                  <Button
                    className="w-full gap-2"
                    onClick={() => abrir(item, 'planejar')}
                    disabled={!item.negocio.responsavel}
                  >
                    <CalendarClock className="h-4 w-4" />
                    Planejar próxima ação
                  </Button>
                )}
                <BusinessNotesDialog negocioId={item.negocio.id} />
              </CardContent>{' '}
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
              {operacao === 'planejar'
                ? 'Planejar próxima ação'
                : operacao === 'realizar'
                  ? 'Concluir atividade'
                  : 'Cancelar atividade'}
            </DialogTitle>
            <DialogDescription>
              {selecionado?.negocio.titulo}. A operação será auditada com autor e data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {operacao === 'planejar' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo *</Label>
                  <select
                    id="tipo"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as TipoAtividade)}
                  >
                    {TIPOS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data">Data e hora *</Label>
                  <Input
                    id="data"
                    type="datetime-local"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea
                    id="descricao"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    maxLength={2000}
                  />
                </div>
              </>
            )}
            {operacao === 'realizar' && (
              <div className="space-y-2">
                <Label htmlFor="resultado">Resultado *</Label>
                <Textarea
                  id="resultado"
                  value={resultado}
                  onChange={(e) => setResultado(e.target.value)}
                  maxLength={1000}
                />
              </div>
            )}
            {operacao === 'cancelar' && (
              <div className="space-y-2">
                <Label htmlFor="justificativa">Justificativa *</Label>
                <Textarea
                  id="justificativa"
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  maxLength={500}
                />
              </div>
            )}
            {operacao !== 'cancelar' && (
              <div className="space-y-2">
                <Label htmlFor="canal">Canal</Label>
                <select
                  id="canal"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={canal}
                  onChange={(e) => setCanal(e.target.value as CanalAtividade | '')}
                >
                  <option value="">Não informado</option>
                  {CANAIS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelecionado(null)} disabled={salvando}>
              Voltar
            </Button>
            <Button onClick={() => void confirmar()} disabled={confirmarDesabilitado}>
              {salvando ? 'Registrando…' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
