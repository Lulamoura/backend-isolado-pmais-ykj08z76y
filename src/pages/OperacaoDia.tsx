import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarClock,
  CircleDollarSign,
  ClipboardCheck,
  MailWarning,
  RefreshCw,
  Target,
  Trophy,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listarFilaAtividades } from '@/services/atividades'
import { listarFechamentos } from '@/services/fechamentos'
import { listarOrdensExecucao } from '@/services/ordens-execucao'
import { listarSlas } from '@/services/slas'
import { listarPropostasSemAbertura, type PropostaSemAbertura } from '@/services/propostas'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'
import { useDashboardResumo } from '@/hooks/use-dashboard'
import type { DashboardResumoParams } from '@/services/dashboard'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { IpcpEducativoDiarioCard } from '@/components/ipcp/IpcpEducativoDiarioCard'
import { obterNexoIpcpDiarioEquipe, ipcpDiarioFixtureHomologado } from '@/services/ipcp'

type OperationSummary = {
  semProximaAcao: number
  acoesVencidas: number
  acoesHoje: number
  slasVencidos: number
  slasAlerta: number
  aguardandoOe: number
  recuperacoes: number
}

const EMPTY: OperationSummary = {
  semProximaAcao: 0,
  acoesVencidas: 0,
  acoesHoje: 0,
  slasVencidos: 0,
  slasAlerta: 0,
  aguardandoOe: 0,
  recuperacoes: 0,
}

const RECIFE_TIME_ZONE = 'America/Recife'

function defaultIndicatorPeriod(reference = new Date()): DashboardResumoParams {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RECIFE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(reference)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const fim = `${values.year}-${values.month}-${values.day}`
  const [year, month, day] = fim.split('-').map(Number)
  const inicio = new Date(Date.UTC(year, month - 1, day - 89)).toISOString().slice(0, 10)
  return { inicio, fim }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100)
}

function formatPercent(value: number | null): string {
  if (value === null) return 'N/D'
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)}%`
}

function modalidadeLabel(modalidade: string): string {
  if (modalidade === 'recorrente') return 'Recorrente'
  if (modalidade === 'evento') return 'Evento'
  if (modalidade === 'serv_eventual') return 'Serv. Eventual'
  return modalidade.replace(/_/g, ' ')
}

function tempoSemAbertura(item: PropostaSemAbertura): string {
  if (item.dias_uteis_sem_abertura > 0) {
    return `${item.dias_uteis_sem_abertura} ${item.dias_uteis_sem_abertura === 1 ? 'dia útil' : 'dias úteis'} sem abertura`
  }
  if (item.horas_corridas_sem_abertura < 1) return 'Enviada há menos de 1 hora'
  return `Enviada há ${item.horas_corridas_sem_abertura} ${item.horas_corridas_sem_abertura === 1 ? 'hora' : 'horas'}`
}

const STATUS_SEM_ABERTURA = {
  recente: { label: 'Recente', className: 'border-blue-200/80 bg-blue-50 text-blue-700' },
  atencao: { label: 'Atenção', className: 'border-amber-200/80 bg-amber-50 text-amber-700' },
  prazo_atingido: {
    label: 'Prazo atingido',
    className: 'border-rose-200/80 bg-rose-50 text-rose-700',
  },
  atrasada: {
    label: 'Atrasada',
    className: 'border-rose-300/80 bg-rose-100/80 text-rose-800 font-medium',
  },
} as const

export default function OperacaoDia() {
  const { perfilSlug } = useIsSuperAdmin()
  const [summary, setSummary] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [partialError, setPartialError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [semAbertura, setSemAbertura] = useState<PropostaSemAbertura[]>([])
  const [limiteDiasUteis, setLimiteDiasUteis] = useState(2)
  const [indicatorDraft, setIndicatorDraft] = useState<DashboardResumoParams>(() =>
    defaultIndicatorPeriod(),
  )
  const [indicatorPeriod, setIndicatorPeriod] = useState<DashboardResumoParams>(() =>
    defaultIndicatorPeriod(),
  )
  const [ipcpDiario, setIpcpDiario] = useState(ipcpDiarioFixtureHomologado)
  const {
    data: indicatorData,
    loading: indicatorLoading,
    error: indicatorError,
    refresh: refreshIndicators,
  } = useDashboardResumo(indicatorPeriod)
  const indicators = indicatorData?.resumo
  const escopoIpcpOperacao =
    perfilSlug === 'superadministrador' || perfilSlug === 'leitura-executiva' ? 'todos' : 'equipe'

  useEffect(() => {
    let active = true
    obterNexoIpcpDiarioEquipe(escopoIpcpOperacao).then((data) => {
      if (active) setIpcpDiario(data)
    })
    return () => {
      active = false
    }
  }, [reloadKey, escopoIpcpOperacao])

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.allSettled([
      listarFilaAtividades('todas', 'dia'),
      listarSlas('atencao'),
      perfilSlug === 'negociacao-propria'
        ? Promise.resolve({ itens: [], responsaveis_envio: [] })
        : listarOrdensExecucao(),
      listarFechamentos('acionavel'),
      listarPropostasSemAbertura(),
    ]).then((results) => {
      if (!active) return
      const [activities, slas, orders, closings, proposals] = results
      setPartialError(results.some((result) => result.status === 'rejected'))
      setSummary({
        semProximaAcao:
          activities.status === 'fulfilled'
            ? activities.value.itens.filter((item) => item.situacao === 'sem_proxima_acao').length
            : 0,
        acoesVencidas:
          activities.status === 'fulfilled'
            ? activities.value.itens.filter((item) => item.situacao === 'vencida').length
            : 0,
        acoesHoje:
          activities.status === 'fulfilled'
            ? activities.value.itens.filter((item) => item.situacao === 'programada').length
            : 0,
        slasVencidos:
          slas.status === 'fulfilled'
            ? slas.value.itens.filter((item) => item.situacao === 'vencido').length
            : 0,
        slasAlerta:
          slas.status === 'fulfilled'
            ? slas.value.itens.filter((item) => item.situacao === 'alerta').length
            : 0,
        aguardandoOe:
          orders.status === 'fulfilled'
            ? orders.value.itens.filter((item) => item.estado_operacional === 'aguardando_oe')
                .length
            : 0,
        recuperacoes:
          closings.status === 'fulfilled'
            ? closings.value.itens.filter((item) => item.agenda?.estado === 'ativa').length
            : 0,
      })
      if (proposals.status === 'fulfilled') {
        setSemAbertura(proposals.value?.itens ?? [])
        setLimiteDiasUteis(proposals.value?.limite_dias_uteis ?? 2)
      } else {
        setSemAbertura([])
      }
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [perfilSlug, reloadKey])

  const acoesTotal = summary.semProximaAcao + summary.acoesVencidas + summary.acoesHoje
  const slasTotal = summary.slasVencidos + summary.slasAlerta

  const cards = [
    {
      title: 'Ações do Dia',
      value: acoesTotal,
      detail: `${summary.semProximaAcao} sem data · ${summary.acoesVencidas} vencida(s) · ${summary.acoesHoje} hoje`,
      path: '/atividades?escopo=dia',
      icon: CalendarClock,
      iconTone: 'text-rose-600 bg-rose-50',
      borderTone:
        acoesTotal > 0 ? 'border-l-4 border-l-rose-500' : 'border-l-4 border-l-emerald-500',
      valueTone: acoesTotal > 0 ? 'text-rose-600' : 'text-emerald-600',
      statusBadge:
        acoesTotal > 0
          ? { label: 'Comprometido', className: 'bg-amber-50 text-amber-700 border-amber-200/60' }
          : {
              label: 'Saudável',
              className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
            },
    },
    {
      title: 'SLAs em atenção',
      value: slasTotal,
      detail: `${summary.slasVencidos} vencido(s) · ${summary.slasAlerta} em alerta · prazo da etapa`,
      path: '/slas?situacao=atencao',
      icon: AlertTriangle,
      iconTone: 'text-amber-600 bg-amber-50',
      borderTone:
        slasTotal > 0 ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-emerald-500',
      valueTone: slasTotal > 0 ? 'text-amber-600' : 'text-emerald-600',
      statusBadge:
        slasTotal > 0
          ? { label: 'Comprometido', className: 'bg-amber-50 text-amber-700 border-amber-200/60' }
          : {
              label: 'Saudável',
              className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
            },
    },
    {
      title: 'Ganhos aguardando OE',
      value: summary.aguardandoOe,
      detail: 'Handoff comercial pendente',
      path: '/ordens-execucao?estado=aguardando_oe',
      icon: ClipboardCheck,
      iconTone: 'text-sky-600 bg-sky-50',
      borderTone:
        summary.aguardandoOe > 0 ? 'border-l-4 border-l-sky-500' : 'border-l-4 border-l-slate-300',
      valueTone: summary.aguardandoOe > 0 ? 'text-sky-700' : 'text-slate-900',
      statusBadge:
        summary.aguardandoOe > 0
          ? { label: 'Pendente', className: 'bg-sky-50 text-sky-700 border-sky-200/60' }
          : { label: 'Regular', className: 'bg-slate-50 text-slate-600 border-slate-200/60' },
    },
    {
      title: 'Oportunidades para recuperar',
      value: summary.recuperacoes,
      detail: 'Agendas de recuperação ativas',
      path: '/fechamentos?recuperacao=acionavel',
      icon: Trophy,
      iconTone: 'text-emerald-600 bg-emerald-50',
      borderTone: 'border-l-4 border-l-emerald-500',
      valueTone: summary.recuperacoes > 0 ? 'text-emerald-600' : 'text-slate-900',
      statusBadge:
        summary.recuperacoes > 0
          ? { label: 'Ativo', className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' }
          : { label: 'Sem agendas', className: 'bg-slate-50 text-slate-600 border-slate-200/60' },
    },
  ].filter(
    (card) => perfilSlug !== 'negociacao-propria' || !card.path.startsWith('/ordens-execucao'),
  )

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Prioridades e exceções
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Operação do Dia</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
            Comece pelos itens que exigem ação. Cada cartão abre a fila operacional correspondente.
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2 border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm"
          disabled={loading}
          onClick={() => {
            setReloadKey((value) => value + 1)
            refreshIndicators()
          }}
        >
          <RefreshCw
            aria-hidden="true"
            className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`}
          />{' '}
          Atualizar
        </Button>
      </section>

      <IpcpEducativoDiarioCard data={ipcpDiario} />

      {partialError && (
        <Alert>
          <AlertTriangle aria-hidden="true" className="h-4 w-4" />
          <AlertTitle>Resumo parcialmente disponível</AlertTitle>
          <AlertDescription>
            Uma das filas não respondeu. Os demais números continuam disponíveis e podem ser
            atualizados.
          </AlertDescription>
        </Alert>
      )}

      <section aria-label="Filas prioritárias" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.title}
              to={card.path}
              className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded-xl"
            >
              <Card
                className={`h-full border border-slate-200/80 bg-white shadow-sm transition-all duration-150 hover:shadow-md hover:border-slate-300 ${card.borderTone}`}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">{card.title}</CardTitle>
                  <span className={`rounded-lg p-1.5 ${card.iconTone}`}>
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`text-3xl font-bold tracking-tight ${card.valueTone}`}>
                      {loading ? '—' : card.value}
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${card.statusBadge.className}`}
                    >
                      {card.statusBadge.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">{card.detail}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </section>

      <Card className="border border-slate-200/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <MailWarning className="h-5 w-5 text-amber-600" /> Propostas sem abertura
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Todas as propostas enviadas que ainda não tiveram abertura registrada. O prazo de
              atenção é de {limiteDiasUteis} dias úteis.
            </p>
          </div>
          <Link
            to="/propostas"
            className="text-sm font-medium text-violet-700 hover:text-violet-800 hover:underline"
          >
            Ver propostas
          </Link>
        </CardHeader>
        <CardContent>
          {semAbertura.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/70 p-4 text-sm text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Todas as propostas enviadas já possuem abertura registrada.</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/75 hover:bg-slate-50/75">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Negócio
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Cliente
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Data do envio
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Tempo sem abertura
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Modalidade
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Responsável
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Dias de vida
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Valor
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {semAbertura.map((item) => {
                    const status = STATUS_SEM_ABERTURA[item.classificacao_sem_abertura]
                    return (
                      <TableRow
                        key={item.negocio_id}
                        data-status={item.classificacao_sem_abertura}
                        className="hover:bg-slate-50/50"
                      >
                        <TableCell>
                          <Link
                            className="font-medium text-violet-700 hover:text-violet-800 hover:underline"
                            to={`/propostas?negocio=${item.negocio_id}`}
                          >
                            AC #{item.external_id || '—'}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">
                          {item.cliente || '—'}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {new Date(item.data_envio).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="whitespace-nowrap text-sm text-slate-800">
                              {tempoSemAbertura(item)}
                            </p>
                            <Badge
                              variant="outline"
                              className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${status.className}`}
                            >
                              {status.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600">{item.modalidade || '—'}</TableCell>
                        <TableCell className="text-slate-600">{item.responsavel || '—'}</TableCell>
                        <TableCell className="text-slate-600">{item.dias_vida}</TableCell>
                        <TableCell className="text-right font-semibold text-slate-900">
                          {formatCurrency(item.valor_centavos)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="primary-indicators-title" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="primary-indicators-title" className="text-lg font-bold text-slate-900">
              Indicadores primários
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Resultado comercial conforme sua carteira e suas permissões de acesso.
            </p>
          </div>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              setIndicatorPeriod(indicatorDraft)
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="indicadores-inicio" className="text-xs text-slate-600 font-medium">
                Início
              </Label>
              <Input
                id="indicadores-inicio"
                aria-label="Início dos indicadores"
                type="date"
                value={indicatorDraft.inicio ?? ''}
                max={indicatorDraft.fim}
                onChange={(event) =>
                  setIndicatorDraft((current) => ({ ...current, inicio: event.target.value }))
                }
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="indicadores-fim" className="text-xs text-slate-600 font-medium">
                Fim
              </Label>
              <Input
                id="indicadores-fim"
                aria-label="Fim dos indicadores"
                type="date"
                value={indicatorDraft.fim ?? ''}
                min={indicatorDraft.inicio}
                onChange={(event) =>
                  setIndicatorDraft((current) => ({ ...current, fim: event.target.value }))
                }
                className="h-9 text-xs"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="h-9 text-xs font-medium"
              disabled={indicatorLoading}
            >
              Aplicar período
            </Button>
          </form>
        </div>

        {indicatorError ? (
          <Alert>
            <AlertTriangle aria-hidden="true" className="h-4 w-4" />
            <AlertTitle>Indicadores temporariamente indisponíveis</AlertTitle>
            <AlertDescription>{indicatorError}</AlertDescription>
          </Alert>
        ) : null}

        <div aria-label="Indicadores comerciais primários" className="grid gap-4 md:grid-cols-2">
          {[
            {
              title: 'Carteira aberta',
              value: indicators ? formatCurrency(indicators.valores.carteira_aberta_centavos) : '—',
              detail: indicators
                ? `${indicators.valores.negocios_precificados} negócios precificados`
                : 'Carregando período',
              icon: Target,
              borderAccent: 'border-l-4 border-l-sky-500',
              valueColor: 'text-slate-900',
              badge: { label: 'Carteira', className: 'bg-sky-50 text-sky-700 border-sky-200/60' },
            },
            {
              title: 'Negócios ganhos',
              value: indicators ? String(indicators.situacao.ganhos) : '—',
              detail: indicators
                ? formatCurrency(indicators.valores.ganho_centavos)
                : 'Carregando período',
              icon: Trophy,
              borderAccent: 'border-l-4 border-l-emerald-500',
              valueColor: 'text-emerald-600',
              badge: {
                label: 'Saudável',
                className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
              },
            },
            {
              title: 'Conversão global',
              value: indicators ? formatPercent(indicators.conversoes.global_percentual) : '—',
              detail: 'Ganhos sobre decisões registradas',
              icon: Target,
              borderAccent: 'border-l-4 border-l-violet-500',
              valueColor: 'text-violet-700',
              badge: {
                label: 'Conversão',
                className: 'bg-violet-50 text-violet-700 border-violet-200/60',
              },
            },
            {
              title: 'Conversão qualitativa',
              value: indicators ? formatPercent(indicators.conversoes.qualitativa_percentual) : '—',
              detail: indicators
                ? `${formatCurrency(indicators.valores.ganho_centavos)} ganhos de ${formatCurrency(indicators.conversoes.decisoes_valor_centavos)} em decisões`
                : 'Valor ganho sobre decisões',
              icon: CircleDollarSign,
              borderAccent: 'border-l-4 border-l-emerald-500',
              valueColor: 'text-emerald-600',
              badge: {
                label: 'Qualitativo',
                className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
              },
            },
          ].map(({ title, value, detail, icon: Icon, borderAccent, valueColor, badge }) => (
            <Card
              key={title}
              className={`border border-slate-200/80 bg-white shadow-sm ${borderAccent}`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.className}`}
                  >
                    {badge.label}
                  </Badge>
                  <Icon aria-hidden="true" className="h-4 w-4 text-slate-400" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className={`text-2xl font-bold tracking-tight ${valueColor}`}>{value}</p>
                <p className="text-xs text-slate-500">{detail}</p>
              </CardContent>
            </Card>
          ))}

          {[
            {
              title: 'Negócios por modalidade',
              description: 'Quantidade e valor total dos negócios no período.',
              items: indicators?.modalidades ?? [],
              borderAccent: 'border-l-4 border-l-slate-400',
            },
            {
              title: 'Ganhos por modalidade',
              description: 'Quantidade e valor dos negócios ganhos no período.',
              items: indicators?.ganhos_por_modalidade ?? [],
              borderAccent: 'border-l-4 border-l-emerald-500',
            },
          ].map(({ title, description, items, borderAccent }) => (
            <Card
              key={title}
              aria-label={title}
              className={`border border-slate-200/80 bg-white shadow-sm ${borderAccent}`}
            >
              <CardHeader className="space-y-1 pb-3">
                <div className="flex items-center gap-2">
                  <BriefcaseBusiness aria-hidden="true" className="h-4 w-4 text-slate-500" />
                  <CardTitle className="text-base font-semibold text-slate-900">{title}</CardTitle>
                </div>
                <p className="text-xs text-slate-500">{description}</p>
              </CardHeader>
              <CardContent>
                <dl className="divide-y divide-slate-100">
                  {['recorrente', 'evento', 'serv_eventual'].map((modalidade) => {
                    const item = items.find((entry) => entry.modalidade === modalidade)
                    return (
                      <div
                        key={modalidade}
                        className="flex items-center justify-between gap-4 py-2.5"
                      >
                        <dt className="text-sm font-medium text-slate-600">
                          {modalidadeLabel(modalidade)}
                        </dt>
                        <dd className="text-sm font-semibold text-slate-900">
                          {indicatorLoading && !indicators
                            ? '—'
                            : `${item?.quantidade ?? 0} · ${formatCurrency(item?.valor_centavos ?? 0)}`}
                        </dd>
                      </div>
                    )
                  })}
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
