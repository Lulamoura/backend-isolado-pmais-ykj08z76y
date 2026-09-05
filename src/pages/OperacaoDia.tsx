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
  const {
    data: indicatorData,
    loading: indicatorLoading,
    error: indicatorError,
    refresh: refreshIndicators,
  } = useDashboardResumo(indicatorPeriod)
  const indicators = indicatorData?.resumo

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

  const cards = [
    {
      title: 'Ações do Dia',
      value: summary.semProximaAcao + summary.acoesVencidas + summary.acoesHoje,
      detail: `${summary.semProximaAcao} sem data · ${summary.acoesVencidas} vencida(s) · ${summary.acoesHoje} hoje`,
      path: '/atividades?escopo=dia',
      icon: CalendarClock,
      tone: 'text-rose-700 bg-rose-50',
    },
    {
      title: 'SLAs em atenção',
      value: summary.slasVencidos + summary.slasAlerta,
      detail: `${summary.slasVencidos} vencido(s) · ${summary.slasAlerta} em alerta · prazo da etapa`,
      path: '/slas?situacao=atencao',
      icon: AlertTriangle,
      tone: 'text-amber-700 bg-amber-50',
    },
    {
      title: 'Ganhos aguardando OE',
      value: summary.aguardandoOe,
      detail: 'Handoff comercial pendente',
      path: '/ordens-execucao?estado=aguardando_oe',
      icon: ClipboardCheck,
      tone: 'text-violet-700 bg-violet-50',
    },
    {
      title: 'Oportunidades para recuperar',
      value: summary.recuperacoes,
      detail: 'Agendas de recuperação ativas',
      path: '/fechamentos?recuperacao=acionavel',
      icon: Trophy,
      tone: 'text-emerald-700 bg-emerald-50',
    },
  ].filter(
    (card) => perfilSlug !== 'negociacao-propria' || !card.path.startsWith('/ordens-execucao'),
  )

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-6 text-white shadow-lg">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-violet-100">
            Prioridades e exceções
          </p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight">Operação do Dia</h2>
          <p className="mt-2 max-w-2xl text-sm text-violet-100/90">
            Comece pelos itens que exigem ação. Cada cartão abre a fila operacional correspondente.
          </p>
        </div>
        <Button
          variant="secondary"
          className="gap-2 bg-white text-violet-900 hover:bg-violet-50 font-medium"
          disabled={loading}
          onClick={() => {
            setReloadKey((value) => value + 1)
            refreshIndicators()
          }}
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" /> Atualizar
        </Button>
      </section>

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
            <Link key={card.title} to={card.path}>
              <Card className="h-full transition hover:border-violet-300 hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">{card.title}</CardTitle>
                  <span className={`rounded-lg p-2 ${card.tone}`}>
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-950">{loading ? '—' : card.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{card.detail}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </section>

      <section aria-labelledby="primary-indicators-title" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="primary-indicators-title" className="text-lg font-bold text-slate-950">
              Indicadores primários
            </h2>
            <p className="mt-1 text-sm text-slate-500">
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
              <Label htmlFor="indicadores-inicio" className="text-xs">
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
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="indicadores-fim" className="text-xs">
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
              />
            </div>
            <Button type="submit" variant="outline" disabled={indicatorLoading}>
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
            },
            {
              title: 'Negócios ganhos',
              value: indicators ? String(indicators.situacao.ganhos) : '—',
              detail: indicators
                ? formatCurrency(indicators.valores.ganho_centavos)
                : 'Carregando período',
              icon: Trophy,
            },
            {
              title: 'Conversão global',
              value: indicators ? formatPercent(indicators.conversoes.global_percentual) : '—',
              detail: 'Ganhos sobre decisões registradas',
              icon: Target,
            },
            {
              title: 'Conversão qualitativa',
              value: indicators ? formatPercent(indicators.conversoes.qualitativa_percentual) : '—',
              detail: indicators
                ? `${formatCurrency(indicators.valores.ganho_centavos)} ganhos de ${formatCurrency(indicators.conversoes.decisoes_valor_centavos)} em decisões`
                : 'Valor ganho sobre decisões',
              icon: CircleDollarSign,
            },
          ].map(({ title, value, detail, icon: Icon }) => (
            <Card key={title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
                <Icon aria-hidden="true" className="h-4 w-4 text-violet-600" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tracking-tight text-slate-950">{value}</p>
                <p className="mt-1 text-xs text-slate-500">{detail}</p>
              </CardContent>
            </Card>
          ))}

          {[
            {
              title: 'Negócios por modalidade',
              description: 'Quantidade e valor total dos negócios no período.',
              items: indicators?.modalidades ?? [],
            },
            {
              title: 'Ganhos por modalidade',
              description: 'Quantidade e valor dos negócios ganhos no período.',
              items: indicators?.ganhos_por_modalidade ?? [],
            },
          ].map(({ title, description, items }) => (
            <Card key={title} aria-label={title}>
              <CardHeader className="space-y-1 pb-3">
                <div className="flex items-center gap-2">
                  <BriefcaseBusiness aria-hidden="true" className="h-4 w-4 text-violet-600" />
                  <CardTitle className="text-base text-slate-900">{title}</CardTitle>
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
                        <dt className="text-sm text-slate-600">{modalidadeLabel(modalidade)}</dt>
                        <dd className="text-sm font-semibold text-slate-950">
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MailWarning className="h-5 w-5 text-amber-600" /> Propostas sem abertura
            </CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Enviadas há pelo menos {limiteDiasUteis} dias úteis completos, sem abertura
              registrada.
            </p>
          </div>
          <Link to="/propostas" className="text-sm font-semibold text-violet-700 hover:underline">
            Ver propostas
          </Link>
        </CardHeader>
        <CardContent>
          {semAbertura.length === 0 ? (
            <p className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-800">
              Nenhuma proposta exige acompanhamento por falta de abertura.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Negócio</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data do envio</TableHead>
                    <TableHead>Modalidade</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Dias de vida</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {semAbertura.map((item) => (
                    <TableRow key={item.negocio_id}>
                      <TableCell>
                        <Link
                          className="font-medium text-violet-700 hover:underline"
                          to={`/propostas?negocio=${item.negocio_id}`}
                        >
                          AC #{item.external_id || '—'}
                        </Link>
                      </TableCell>
                      <TableCell>{item.cliente || '—'}</TableCell>
                      <TableCell>{new Date(item.data_envio).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>{item.modalidade || '—'}</TableCell>
                      <TableCell>{item.responsavel || '—'}</TableCell>
                      <TableCell>{item.dias_vida}</TableCell>
                      <TableCell className="text-right">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(item.valor_centavos / 100)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
