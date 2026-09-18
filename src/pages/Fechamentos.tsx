import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, ExternalLink, RefreshCw, Trophy, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  decidirFechamento,
  listarFechamentos,
  novaChaveFechamento,
  descartarRecuperacao,
  motivoPerdaLabel,
  type ItemFechamento,
  type MotivoPerda,
  type StatusFechamento,
} from '@/services/fechamentos'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'
import { CommercialContextCard } from '@/components/CommercialContextCard'
import { CommercialFilters } from '@/components/CommercialFilters'
import { NexoBusinessActions } from '@/components/NexoBusinessActions'
import {
  commercialActionCardClass,
  commercialOutcomeCardClass,
  filterAndSortCommercial,
  type CommercialSort,
} from '@/lib/commercial-context'

const motivos: Array<{ value: MotivoPerda; label: string }> = [
  { value: 'preco', label: 'Preço' },
  { value: 'fechou_com_outra_empresa', label: 'Fechou com outra empresa' },
  { value: 'perdeu_contato', label: 'Perdeu contato' },
  { value: 'desistiu', label: 'Desistiu' },
  { value: 'nao_atendido', label: 'Não atendido' },
]

export default function Fechamentos() {
  const [searchParams] = useSearchParams()
  const somenteRecuperacoes = searchParams.get('recuperacao') === 'acionavel'
  const { perfilSlug } = useIsSuperAdmin()
  const somenteLeituraPerfil = perfilSlug === 'leitura-executiva'
  const [itens, setItens] = useState<ItemFechamento[]>([])
  const [loading, setLoading] = useState(true)
  const [motivo, setMotivo] = useState<Record<string, MotivoPerda>>({})
  const [valor, setValor] = useState<Record<string, string>>({})
  const [evidencia, setEvidencia] = useState<Record<string, string>>({})
  const [dataAlvo, setDataAlvo] = useState<Record<string, string>>({})
  const [justificativaDescarte, setJustificativaDescarte] = useState<Record<string, string>>({})
  const [busca, setBusca] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [situacaoAcao, setSituacaoAcao] = useState('')
  const [ordenacao, setOrdenacao] = useState<CommercialSort>('proxima_acao')
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFim, setPeriodoFim] = useState('')
  const [statusFechamento, setStatusFechamento] = useState<StatusFechamento>('todos')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      setItens(
        (
          await listarFechamentos(
            somenteRecuperacoes ? 'acionavel' : 'todas',
            somenteRecuperacoes ? 'perdido' : statusFechamento,
          )
        ).itens,
      )
    } catch (_) {
      toast.error('Não foi possível carregar os fechamentos.')
    } finally {
      setLoading(false)
    }
  }, [somenteRecuperacoes, statusFechamento])
  useEffect(() => void carregar(), [carregar])
  const itensVisiveis = useMemo(
    () =>
      filterAndSortCommercial(
        itens,
        busca,
        responsavel,
        situacaoAcao,
        ordenacao,
        periodoInicio,
        periodoFim,
      ),
    [itens, busca, responsavel, situacaoAcao, ordenacao, periodoInicio, periodoFim],
  )

  const ganhar = async (item: ItemFechamento) => {
    try {
      await decidirFechamento({
        negocio_id: item.negocio.id,
        decisao: 'ganho',
        valor_efetivo_centavos: Math.round(Number(valor[item.negocio.id]) * 100),
        evidencia_formal: evidencia[item.negocio.id],
        updated_esperado: item.negocio.updated,
        command_idempotency_key: novaChaveFechamento('ganho', item.negocio.id),
      })
      toast.success('Ganho registrado.')
      await carregar()
    } catch (_) {
      toast.error('O ganho não pôde ser registrado.')
    }
  }

  const perder = async (item: ItemFechamento) => {
    try {
      await decidirFechamento({
        negocio_id: item.negocio.id,
        decisao: 'perdido',
        motivo: motivo[item.negocio.id],
        data_alvo_recuperacao: dataAlvo[item.negocio.id] || null,
        antecedencia_dias: 60,
        updated_esperado: item.negocio.updated,
        command_idempotency_key: novaChaveFechamento('perda', item.negocio.id),
      })
      toast.success('Perda registrada.')
      await carregar()
    } catch (_) {
      toast.error('A perda não pôde ser registrada.')
    }
  }

  const descartar = async (item: ItemFechamento) => {
    try {
      await descartarRecuperacao({
        negocio_perdido_id: item.negocio.id,
        agenda_id: item.agenda?.id,
        justificativa: justificativaDescarte[item.negocio.id],
        updated_esperado: item.negocio.updated,
        command_idempotency_key: novaChaveFechamento('descartar-recuperacao', item.negocio.id),
      })
      toast.success('Recuperação descartada com justificativa registrada.')
      await carregar()
    } catch (_) {
      toast.error('A recuperação não pôde ser descartada.')
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {somenteRecuperacoes ? 'Operação · Recuperação' : 'Etapa 3 · Decisão'}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {somenteRecuperacoes ? 'Oportunidades para Recuperar' : 'Ganho, perda e reativação'}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
            {somenteRecuperacoes
              ? 'Perdas com Data de Recuperação Comercial vencida ou prevista para hoje.'
              : 'Decisões terminais e recuperação auditáveis.'}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void carregar()}
          disabled={loading}
          className="gap-2 border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm"
        >
          <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </section>

      <CommercialFilters
        contexts={itens.map((item) => item.contexto)}
        search={busca}
        owner={responsavel}
        status={situacaoAcao}
        sort={ordenacao}
        onSearch={setBusca}
        onOwner={setResponsavel}
        onStatus={setSituacaoAcao}
        onSort={setOrdenacao}
        periodStart={periodoInicio}
        periodEnd={periodoFim}
        onPeriodStart={setPeriodoInicio}
        onPeriodEnd={setPeriodoFim}
      />

      {!somenteRecuperacoes && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm max-w-xs">
          <Label
            htmlFor="status-fechamento"
            className="text-xs font-semibold uppercase tracking-wider text-slate-500 shrink-0"
          >
            Status
          </Label>
          <Select
            value={statusFechamento}
            onValueChange={(value) => setStatusFechamento(value as StatusFechamento)}
          >
            <SelectTrigger
              id="status-fechamento"
              aria-label="Status do fechamento"
              className="h-9 border-slate-200 bg-white text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ganho">Ganho</SelectItem>
              <SelectItem value="perdido">Perdido</SelectItem>
              <SelectItem value="reativacao">Reativação</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {itensVisiveis.map((item) => {
          const terminal = Boolean(item.negocio.resultado)
          const perdeuContato = motivo[item.negocio.id] === 'perdeu_contato'
          const contatoValido =
            !perdeuContato ||
            (item.tentativas_contato >= 5 && item.janela_tentativas_dias_uteis >= 10)
          const badgeStatus = terminal
            ? item.negocio.resultado === 'ganho'
              ? {
                  label: 'Ganho',
                  className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
                }
              : { label: 'Perdido', className: 'bg-rose-50 text-rose-700 border-rose-200/60' }
            : item.proposta_aceita
              ? {
                  label: 'Apta a fechamento',
                  className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
                }
              : item.proposta_emitida
                ? {
                    label: 'Proposta emitida',
                    className: 'bg-sky-50 text-sky-700 border-sky-200/60',
                  }
                : item.proposta_estado
                  ? {
                      label: 'Proposta em elaboração',
                      className: 'bg-amber-50 text-amber-700 border-amber-200/60',
                    }
                  : {
                      label: 'Sem proposta criada',
                      className: 'bg-slate-50 text-slate-600 border-slate-200/60',
                    }

          return (
            <Card
              key={item.negocio.id}
              className={`border border-slate-200/80 bg-white shadow-sm transition-all duration-150 hover:shadow-md hover:border-slate-300 ${
                terminal
                  ? commercialOutcomeCardClass(item.negocio.resultado)
                  : commercialActionCardClass(item.contexto.proxima_acao_em)
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Decisão
                    </p>
                    <CardTitle className="text-base font-semibold text-slate-900">
                      {item.negocio.titulo}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      {item.negocio.etapa || 'Terminal'}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeStatus.className}`}
                  >
                    {badgeStatus.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <CommercialContextCard
                  contexto={item.contexto}
                  etapa={item.negocio.etapa}
                  negocioId={item.negocio.id}
                  showNextAction={!terminal}
                  showReadOnlyNotice={!terminal}
                />
                <NexoBusinessActions
                  externalId={item.contexto.external_id}
                  businessTitle={item.negocio.titulo}
                  allowNexoHelp={!terminal}
                />
                {!terminal ? (
                  <>
                    {!item.elegivel_fechamento && (
                      <p className="rounded-lg border border-amber-200/80 bg-amber-50/70 p-3 text-xs font-medium text-amber-800">
                        Visível para acompanhamento gerencial; ainda não elegível como pendência de
                        fechamento.
                      </p>
                    )}
                    {!somenteLeituraPerfil && !item.contexto.somente_leitura && (
                      <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700">
                              Valor efetivo do ganho
                            </Label>
                            <Input
                              className="border-slate-200 bg-white text-sm"
                              value={valor[item.negocio.id] || ''}
                              onChange={(e) =>
                                setValor((v) => ({
                                  ...v,
                                  [item.negocio.id]: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700">
                              Evidência formal
                            </Label>
                            <Input
                              className="border-slate-200 bg-white text-sm"
                              value={evidencia[item.negocio.id] || ''}
                              onChange={(e) =>
                                setEvidencia((v) => ({
                                  ...v,
                                  [item.negocio.id]: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                        <Button
                          className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
                          disabled={
                            !item.proposta_emitida ||
                            !Number(valor[item.negocio.id]) ||
                            !evidencia[item.negocio.id]?.trim()
                          }
                          onClick={() => void ganhar(item)}
                        >
                          <Trophy className="h-4 w-4" /> Registrar ganho
                        </Button>
                        <div className="border-t border-slate-200 pt-3 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Ou registrar perda
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Select
                              value={motivo[item.negocio.id]}
                              onValueChange={(x) =>
                                setMotivo((v) => ({
                                  ...v,
                                  [item.negocio.id]: x as MotivoPerda,
                                }))
                              }
                            >
                              <SelectTrigger className="border-slate-200 bg-white text-xs">
                                <SelectValue placeholder="Motivo da perda" />
                              </SelectTrigger>
                              <SelectContent>
                                {motivos.map((x) => (
                                  <SelectItem key={x.value} value={x.value}>
                                    {x.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="date"
                              className="border-slate-200 bg-white text-xs"
                              value={dataAlvo[item.negocio.id] || ''}
                              onChange={(e) =>
                                setDataAlvo((v) => ({
                                  ...v,
                                  [item.negocio.id]: e.target.value,
                                }))
                              }
                            />
                          </div>
                          {perdeuContato && (
                            <p className="mt-1 text-xs text-slate-500">
                              Tentativas: {item.tentativas_contato}/5 · janela:{' '}
                              {item.janela_tentativas_dias_uteis}/10 dias úteis
                            </p>
                          )}
                          <Button
                            className="w-full gap-2 border-rose-200 bg-rose-50/60 text-rose-700 hover:bg-rose-100 hover:text-rose-800"
                            variant="outline"
                            disabled={!motivo[item.negocio.id] || !contatoValido}
                            onClick={() => void perder(item)}
                          >
                            <XCircle className="h-4 w-4" /> Registrar perda
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : item.negocio.resultado === 'perdido' ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-rose-200/80 bg-rose-50/70 p-3.5 text-sm text-rose-900">
                      <p className="font-semibold">
                        Proposta perdida — {motivoPerdaLabel(item.negocio.fechamento_motivo)}
                      </p>
                      <p className="mt-1 text-xs text-rose-700">
                        Decisão registrada em{' '}
                        {item.negocio.fechamento_data
                          ? new Date(item.negocio.fechamento_data).toLocaleDateString('pt-BR', {
                              timeZone: 'UTC',
                            })
                          : 'data não informada'}
                      </p>
                    </div>
                    <p className="text-sm text-slate-600">
                      {item.agenda
                        ? `Recuperação em ${item.agenda.data_alvo}`
                        : 'Sem agenda de recuperação ativa'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {item.contexto.activecampaign_url ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          asChild
                        >
                          <a
                            href={item.contexto.activecampaign_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5 text-slate-500" /> Recuperar
                            no ActiveCampaign
                          </a>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-200 bg-white text-slate-400"
                          disabled
                        >
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Negócio sem vínculo no CRM
                        </Button>
                      )}
                    </div>
                    {perfilSlug !== 'negociacao-propria' &&
                      !somenteLeituraPerfil &&
                      item.agenda && (
                        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3.5">
                          <Label
                            htmlFor={`descarte-${item.negocio.id}`}
                            className="text-xs font-semibold text-slate-700"
                          >
                            Justificativa para não recuperar
                          </Label>
                          <Textarea
                            id={`descarte-${item.negocio.id}`}
                            className="border-slate-200 bg-white text-sm"
                            value={justificativaDescarte[item.negocio.id] || ''}
                            onChange={(event) =>
                              setJustificativaDescarte((current) => ({
                                ...current,
                                [item.negocio.id]: event.target.value,
                              }))
                            }
                            placeholder="Informe o motivo da decisão (mínimo de 10 caracteres)."
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="gap-1.5"
                            disabled={
                              (justificativaDescarte[item.negocio.id] || '').trim().length < 10
                            }
                            onClick={() => void descartar(item)}
                          >
                            <Ban className="h-3.5 w-3.5" /> Descartar recuperação
                          </Button>
                        </div>
                      )}
                  </div>
                ) : (
                  <p className="rounded-lg border border-emerald-200/80 bg-emerald-50/70 p-3.5 text-xs text-emerald-800 font-medium">
                    Negócio ganho e encaminhado para Ordens de Execução. Acompanhe nessa etapa o
                    número da OE, a data e o responsável pelo envio.
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
