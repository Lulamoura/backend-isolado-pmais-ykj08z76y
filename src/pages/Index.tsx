import { useEffect, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  CircleX,
  Filter,
  ListChecks,
  PieChart as PieChartIcon,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useDashboardResumo } from '@/hooks/use-dashboard'
import { motivoPerdaLabel } from '@/services/fechamentos'
import type { DashboardResumoParams } from '@/services/dashboard'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const RECIFE_TIME_ZONE = 'America/Recife'
const LOSS_COLORS = ['#8b5cf6', '#6366f1', '#06b6d4', '#f59e0b', '#ec4899', '#64748b']
const DISTRIBUTION_COLORS = [
  '#7c3aed',
  '#2563eb',
  '#0891b2',
  '#059669',
  '#d97706',
  '#db2777',
  '#64748b',
  '#9333ea',
]

function configuredDefaultPeriodDays(): number {
  const configured = Number(import.meta.env.VITE_DASHBOARD_DEFAULT_PERIOD_DAYS ?? 90)
  return Number.isInteger(configured) && configured > 0 && configured <= 366 ? configured : 90
}

function civilDateInRecife(reference: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RECIFE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(reference)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function shiftCivilDate(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

export function createDefaultDashboardPeriod(reference = new Date()): {
  inicio: string
  fim: string
} {
  const fim = civilDateInRecife(reference)
  return {
    inicio: shiftCivilDate(fim, -(configuredDefaultPeriodDays() - 1)),
    fim,
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value / 100)
}

function formatPercent(value: number | null): string {
  if (value === null) return 'N/D'
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)}%`
}

interface MetricCardProps {
  title: string
  value: string
  detail: string
  icon: typeof BriefcaseBusiness
  borderTone?: string
  valueTone?: string
  iconTone?: string
  badge?: {
    label: string
    className: string
  }
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  borderTone = 'border-l-4 border-l-slate-300',
  valueTone = 'text-slate-900',
  iconTone = 'text-violet-600 bg-violet-50',
  badge,
}: MetricCardProps) {
  return (
    <Card
      className={`rounded-xl border border-slate-200/80 bg-white shadow-sm transition-all duration-150 hover:shadow-md hover:border-slate-300 ${borderTone}`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
        <div className="flex items-center gap-2">
          {badge && (
            <Badge
              variant="outline"
              className={`rounded-full text-[11px] font-medium px-2 py-0.5 ${badge.className}`}
            >
              {badge.label}
            </Badge>
          )}
          <span className={`rounded-lg p-1.5 ${iconTone}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className={`text-2xl font-bold tracking-tight ${valueTone}`}>{value}</p>
        <p className="text-xs text-slate-500">{detail}</p>
      </CardContent>
    </Card>
  )
}

interface DetailItem {
  label: string
  value: string
}

interface DetailCardProps {
  title: string
  description: string
  items: DetailItem[]
  icon: typeof BriefcaseBusiness
  borderTone?: string
  iconTone?: string
}

function DetailCard({
  title,
  description,
  items,
  icon: Icon,
  borderTone = 'border-l-4 border-l-slate-300',
  iconTone = 'text-slate-600 bg-slate-100',
}: DetailCardProps) {
  return (
    <Card
      aria-label={title}
      className={`rounded-xl border border-slate-200/80 bg-white shadow-sm transition-all duration-150 hover:shadow-md hover:border-slate-300 ${borderTone}`}
    >
      <CardHeader className="space-y-1 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className={`rounded-lg p-1.5 ${iconTone}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <CardTitle className="text-base font-bold text-slate-900">{title}</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        <dl className="divide-y divide-slate-100">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-sm text-slate-600">{item.label}</dt>
              <dd className="text-sm font-semibold text-slate-900">{item.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

interface DistributionItem {
  label: string
  quantidade: number
}

interface DistributionPieCardProps {
  title: string
  description: string
  chartLabel: string
  emptyMessage: string
  items: DistributionItem[]
}

function DistributionPieCard({
  title,
  description,
  chartLabel,
  emptyMessage,
  items,
}: DistributionPieCardProps) {
  const total = items.reduce((sum, item) => sum + item.quantidade, 0)

  return (
    <Card
      aria-label={title}
      className="rounded-xl border border-slate-200/80 bg-white shadow-sm transition-all duration-150 hover:shadow-md hover:border-slate-300"
    >
      <CardHeader className="space-y-1 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg p-1.5 text-violet-600 bg-violet-50">
            <PieChartIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <CardTitle className="text-base font-bold text-slate-900">{title}</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {items.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">{emptyMessage}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[minmax(13rem,0.85fr)_minmax(13rem,1.15fr)] sm:items-center">
            <div className="h-64" aria-label={chartLabel}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={items}
                    dataKey="quantidade"
                    nameKey="label"
                    innerRadius={52}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {items.map((item, index) => (
                      <Cell
                        key={item.label}
                        fill={DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '0.75rem',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                    }}
                    formatter={(value: number | string | undefined) => [
                      `${Number(value ?? 0)} negócio(s)`,
                      'Quantidade',
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2">
              {items.map((item, index) => (
                <li
                  key={item.label}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white p-2.5 transition-colors hover:bg-slate-50/50"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length],
                      }}
                      aria-hidden="true"
                    />
                    <span className="truncate text-xs font-medium text-slate-700">
                      {item.label}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-slate-900">
                    {item.quantidade} · {formatPercent(total ? (item.quantidade / total) * 100 : 0)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div aria-label="Carregando indicadores" className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {Array.from({ length: 8 }, (_, index) => (
        <Card key={index} className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <CardHeader className="p-0 pb-3">
            <Skeleton className="h-4 w-36" />
          </CardHeader>
          <CardContent className="space-y-2 p-0">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3 w-44" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function Index() {
  const { user } = useAuth()
  const [draftPeriod, setDraftPeriod] = useState(createDefaultDashboardPeriod)
  const [period, setPeriod] = useState(draftPeriod)
  const [draftFilters, setDraftFilters] = useState({
    equipe_id: 'todos',
    responsavel_id: 'todos',
    modalidade: 'todas',
    situacao: 'todos',
    incluir_inativos: false,
  })
  const [filters, setFilters] = useState<
    Pick<
      DashboardResumoParams,
      'equipe_id' | 'responsavel_id' | 'modalidade' | 'situacao' | 'incluir_inativos'
    >
  >({})
  const [filterOptions, setFilterOptions] = useState({
    equipes: [] as Array<{ id: string; nome: string }>,
    responsaveis: [] as Array<{ id: string; nome: string; ativo: boolean }>,
  })
  const { data, loading, error, refresh } = useDashboardResumo({ ...period, ...filters })

  useEffect(() => {
    if (!data?.opcoes_filtro) return
    setFilterOptions({
      equipes: [...data.opcoes_filtro.equipes].sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR'),
      ),
      responsaveis: [...data.opcoes_filtro.responsaveis].sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR'),
      ),
    })
  }, [data?.opcoes_filtro])

  function applyPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draftPeriod.inicio || !draftPeriod.fim || draftPeriod.inicio > draftPeriod.fim) return
    setPeriod(draftPeriod)
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFilters({
      ...(draftFilters.equipe_id === 'todos' ? {} : { equipe_id: draftFilters.equipe_id }),
      ...(draftFilters.responsavel_id === 'todos'
        ? {}
        : { responsavel_id: draftFilters.responsavel_id }),
      ...(draftFilters.modalidade === 'todas'
        ? {}
        : {
            modalidade: draftFilters.modalidade as 'recorrente' | 'evento' | 'serv_eventual',
          }),
      ...(draftFilters.situacao === 'todos'
        ? {}
        : {
            situacao: draftFilters.situacao as NonNullable<DashboardResumoParams['situacao']>,
          }),
      ...(draftFilters.incluir_inativos ? { incluir_inativos: true } : {}),
    })
  }

  function clearFilters() {
    setDraftFilters({
      equipe_id: 'todos',
      responsavel_id: 'todos',
      modalidade: 'todas',
      situacao: 'todos',
      incluir_inativos: false,
    })
    setFilters({})
  }

  const resumo = data?.resumo
  const perdasPorMotivo = resumo?.perdas_por_motivo ?? []
  const fontesProspeccao = (resumo?.fontes_prospeccao ?? []).map((item) => ({
    label: item.fonte,
    quantidade: item.quantidade,
  }))
  const negociosPorResponsavel = (resumo?.responsaveis ?? []).map((item) => ({
    label: item.responsavel,
    quantidade: item.quantidade,
  }))

  return (
    <div className="space-y-6">
      {/* Cabeçalho da página padronizado (superfície neutra limpa + inspiração da referência) */}
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Painel de Indicadores · Análises
            </p>
            <Badge
              variant="outline"
              className="rounded-full border-violet-200/60 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700"
            >
              Dashboard V1
            </Badge>
            {data?.escopo && (
              <Badge
                variant="outline"
                className="rounded-full border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700"
              >
                Escopo: {data.escopo}
              </Badge>
            )}
          </div>
          <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
              <BarChart3 aria-hidden="true" className="h-5 w-5" />
            </span>
            <span>
              Visão comercial{' '}
              <span className="font-semibold text-slate-600">de {user?.name || 'Usuário'}</span>
            </span>
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm text-slate-600">
            Indicadores do modelo canônico PMais, com datas civis de Recife e valores em reais.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="rounded-full border-slate-200/80 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700"
          >
            <CalendarDays aria-hidden="true" className="mr-1 h-3.5 w-3.5 text-slate-500" />{' '}
            America/Recife
          </Badge>
          <Button
            type="button"
            variant="outline"
            onClick={refresh}
            disabled={loading}
            className="h-9 gap-1.5 border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
          >
            <RefreshCw
              aria-hidden="true"
              className={`h-3.5 w-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`}
            />
            Atualizar
          </Button>
        </div>
      </section>

      {/* Painel de Filtros com inspiração na referência do usuário */}
      <Card
        aria-labelledby="dashboard-filters-title"
        className="rounded-xl border border-slate-200/80 bg-white shadow-sm"
      >
        <CardHeader className="border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-slate-100 p-1.5 text-slate-600">
                <Filter className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Filtros de Período e Gestão
                </p>
                <CardTitle
                  id="dashboard-filters-title"
                  className="text-base font-bold text-slate-900"
                >
                  Filtros de gestão
                </CardTitle>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Período ativo:{' '}
              <strong className="font-semibold text-slate-700">{period.inicio}</strong> a{' '}
              <strong className="font-semibold text-slate-700">{period.fim}</strong>
            </p>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Refine os indicadores por equipe, responsável, modalidade, situação comercial e
            cadastro.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* Seção 1: Filtro de Período */}
          <form
            onSubmit={applyPeriod}
            className="rounded-lg border border-slate-100 bg-slate-50/60 p-3.5"
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label
                  htmlFor="dashboard-inicio"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Início
                </Label>
                <Input
                  id="dashboard-inicio"
                  type="date"
                  value={draftPeriod.inicio}
                  max={draftPeriod.fim}
                  onChange={(event) =>
                    setDraftPeriod((current) => ({ ...current, inicio: event.target.value }))
                  }
                  className="h-9 border-slate-200 bg-white text-xs font-normal text-slate-800 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="dashboard-fim"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Fim
                </Label>
                <Input
                  id="dashboard-fim"
                  type="date"
                  value={draftPeriod.fim}
                  min={draftPeriod.inicio}
                  onChange={(event) =>
                    setDraftPeriod((current) => ({ ...current, fim: event.target.value }))
                  }
                  className="h-9 border-slate-200 bg-white text-xs font-normal text-slate-800 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
              <Button
                type="submit"
                disabled={loading || draftPeriod.inicio > draftPeriod.fim}
                className="h-9 bg-violet-600 px-4 text-xs font-medium text-white shadow-sm hover:bg-violet-700"
              >
                Aplicar período
              </Button>
            </div>
          </form>

          {/* Seção 2: Filtros de Gestão */}
          <form
            onSubmit={applyFilters}
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 xl:items-end"
          >
            <div className="space-y-1.5">
              <Label
                htmlFor="dashboard-equipe"
                className="text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Equipe
              </Label>
              <Select
                value={draftFilters.equipe_id}
                onValueChange={(value) =>
                  setDraftFilters((current) => ({ ...current, equipe_id: value }))
                }
              >
                <SelectTrigger
                  id="dashboard-equipe"
                  aria-label="Equipe"
                  className="h-9 border-slate-200 bg-white text-xs text-slate-800 shadow-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                >
                  <SelectValue placeholder="Todas as equipes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as equipes</SelectItem>
                  {filterOptions.equipes.map((equipe) => (
                    <SelectItem key={equipe.id} value={equipe.id}>
                      {equipe.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="dashboard-modalidade"
                className="text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Modalidade
              </Label>
              <Select
                value={draftFilters.modalidade}
                onValueChange={(value) =>
                  setDraftFilters((current) => ({ ...current, modalidade: value }))
                }
              >
                <SelectTrigger
                  id="dashboard-modalidade"
                  aria-label="Modalidade"
                  className="h-9 border-slate-200 bg-white text-xs text-slate-800 shadow-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                >
                  <SelectValue placeholder="Todas as modalidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as modalidades</SelectItem>
                  <SelectItem value="recorrente">Recorrente</SelectItem>
                  <SelectItem value="evento">Evento</SelectItem>
                  <SelectItem value="serv_eventual">Serv. Eventual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="dashboard-responsavel"
                className="text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Responsável
              </Label>
              <Select
                value={draftFilters.responsavel_id}
                onValueChange={(value) =>
                  setDraftFilters((current) => ({ ...current, responsavel_id: value }))
                }
              >
                <SelectTrigger
                  id="dashboard-responsavel"
                  aria-label="Responsável"
                  className="h-9 border-slate-200 bg-white text-xs text-slate-800 shadow-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                >
                  <SelectValue placeholder="Todos os responsáveis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os responsáveis</SelectItem>
                  {filterOptions.responsaveis.map((responsavel) => (
                    <SelectItem key={responsavel.id} value={responsavel.id}>
                      {responsavel.nome}
                      {responsavel.ativo ? '' : ' (inativo)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="dashboard-situacao"
                className="text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Situação
              </Label>
              <Select
                value={draftFilters.situacao}
                onValueChange={(value) =>
                  setDraftFilters((current) => ({ ...current, situacao: value }))
                }
              >
                <SelectTrigger
                  id="dashboard-situacao"
                  aria-label="Situação"
                  className="h-9 border-slate-200 bg-white text-xs text-slate-800 shadow-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                >
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="negociacao">Negociação</SelectItem>
                  <SelectItem value="ganhos">Ganhos</SelectItem>
                  <SelectItem value="perdidos">Perdidos</SelectItem>
                  <SelectItem value="aguardando_oe">Aguardando OE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm">
              <Switch
                id="dashboard-inativos"
                checked={draftFilters.incluir_inativos}
                onCheckedChange={(checked) =>
                  setDraftFilters((current) => ({ ...current, incluir_inativos: checked }))
                }
              />
              <Label
                htmlFor="dashboard-inativos"
                className="cursor-pointer text-xs font-medium text-slate-700"
              >
                Incluir negócios inativos
              </Label>
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={loading}
                className="h-9 bg-slate-900 px-4 text-xs font-medium text-white shadow-sm hover:bg-slate-800"
              >
                Aplicar filtros
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={clearFilters}
                disabled={loading || Object.keys(filters).length === 0}
                className="h-9 border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <X className="mr-1.5 h-3.5 w-3.5" /> Limpar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Não foi possível carregar o dashboard</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading && !resumo ? (
        <DashboardSkeleton />
      ) : resumo ? (
        <section
          aria-label="Indicadores comerciais"
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <MetricCard
            title="Negócios no período"
            value={String(resumo.total)}
            detail={`${resumo.situacao.abertos} abertos`}
            icon={BriefcaseBusiness}
            borderTone="border-l-4 border-l-slate-400"
            valueTone="text-slate-900"
            iconTone="text-slate-600 bg-slate-100"
            badge={{
              label: `${resumo.situacao.abertos} em andamento`,
              className: 'bg-slate-50 text-slate-700 border-slate-200/60',
            }}
          />
          <MetricCard
            title="Carteira aberta"
            value={formatCurrency(resumo.valores.carteira_aberta_centavos)}
            detail={`${resumo.valores.negocios_precificados} negócios precificados`}
            icon={Target}
            borderTone="border-l-4 border-l-sky-500"
            valueTone="text-sky-700"
            iconTone="text-sky-600 bg-sky-50"
            badge={{
              label: 'Carteira ativa',
              className: 'bg-sky-50 text-sky-700 border-sky-200/60',
            }}
          />
          <MetricCard
            title="Negócios ganhos"
            value={String(resumo.situacao.ganhos)}
            detail={formatCurrency(resumo.valores.ganho_centavos)}
            icon={Trophy}
            borderTone="border-l-4 border-l-emerald-500"
            valueTone="text-emerald-700"
            iconTone="text-emerald-600 bg-emerald-50"
            badge={{
              label: 'Resultado ganho',
              className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
            }}
          />
          <MetricCard
            title="Negócios perdidos"
            value={String(resumo.situacao.perdidos)}
            detail={formatCurrency(resumo.valores.perdido_centavos)}
            icon={CircleX}
            borderTone="border-l-4 border-l-rose-500"
            valueTone="text-rose-700"
            iconTone="text-rose-600 bg-rose-50"
            badge={{
              label: resumo.situacao.perdidos > 0 ? 'Perdas registradas' : 'Sem perdas',
              className:
                resumo.situacao.perdidos > 0
                  ? 'bg-rose-50 text-rose-700 border-rose-200/60'
                  : 'bg-slate-50 text-slate-600 border-slate-200/60',
            }}
          />
          <MetricCard
            title="Conversão global"
            value={formatPercent(resumo.conversoes.global_percentual)}
            detail="Ganhos sobre decisões registradas"
            icon={TrendingUp}
            borderTone="border-l-4 border-l-violet-500"
            valueTone="text-violet-700"
            iconTone="text-violet-600 bg-violet-50"
            badge={{
              label: 'Taxa global',
              className: 'bg-violet-50 text-violet-700 border-violet-200/60',
            }}
          />
          <MetricCard
            title="Conversão qualitativa"
            value={formatPercent(resumo.conversoes.qualitativa_percentual ?? null)}
            detail={`${formatCurrency(resumo.valores.ganho_centavos)} ganhos de ${formatCurrency(resumo.conversoes.decisoes_valor_centavos ?? 0)} em decisões`}
            icon={CircleDollarSign}
            borderTone="border-l-4 border-l-emerald-500"
            valueTone="text-emerald-700"
            iconTone="text-emerald-600 bg-emerald-50"
            badge={{
              label: 'Em valor',
              className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
            }}
          />
          <MetricCard
            title="Taxa de qualificação"
            value={formatPercent(resumo.conversoes.qualificacao_percentual)}
            detail={`${resumo.qualificacao.qualificadas} qualificadas de ${resumo.qualificacao.qualificadas + resumo.qualificacao.desqualificadas} decisões`}
            icon={UserCheck}
            borderTone="border-l-4 border-l-amber-500"
            valueTone="text-amber-700"
            iconTone="text-amber-600 bg-amber-50"
            badge={{
              label: 'Triagem',
              className: 'bg-amber-50 text-amber-700 border-amber-200/60',
            }}
          />
          <MetricCard
            title="Cobertura de responsável"
            value={formatPercent(resumo.cobertura.responsavel.percentual)}
            detail={`${resumo.cobertura.responsavel.preenchidos} de ${resumo.cobertura.responsavel.total} negócios`}
            icon={ShieldCheck}
            borderTone={
              (resumo.cobertura.responsavel.percentual ?? 0) >= 100
                ? 'border-l-4 border-l-emerald-500'
                : 'border-l-4 border-l-amber-500'
            }
            valueTone={
              (resumo.cobertura.responsavel.percentual ?? 0) >= 100
                ? 'text-emerald-700'
                : 'text-amber-700'
            }
            iconTone="text-sky-600 bg-sky-50"
            badge={{
              label:
                (resumo.cobertura.responsavel.percentual ?? 0) >= 100
                  ? 'Completa'
                  : 'Atenção cadastral',
              className:
                (resumo.cobertura.responsavel.percentual ?? 0) >= 100
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                  : 'bg-amber-50 text-amber-700 border-amber-200/60',
            }}
          />
        </section>
      ) : null}

      {resumo ? (
        <section aria-labelledby="dashboard-details-title" className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-200/80 pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Segmentação e Qualidade
              </p>
              <h2 id="dashboard-details-title" className="text-lg font-bold text-slate-900">
                Detalhamento comercial
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Composição, valores e qualidade cadastral do período selecionado.
              </p>
            </div>
            <Badge
              variant="outline"
              className="rounded-full border-slate-200/80 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
            >
              Auditoria ativa
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DetailCard
              title="Composição dos negócios"
              description="Distribuição pelo resultado canônico atual."
              icon={BriefcaseBusiness}
              borderTone="border-l-4 border-l-slate-400"
              iconTone="text-slate-600 bg-slate-100"
              items={[
                { label: 'Abertos', value: String(resumo.situacao.abertos) },
                { label: 'Ganhos', value: String(resumo.situacao.ganhos) },
                { label: 'Perdidos', value: String(resumo.situacao.perdidos) },
                { label: 'Desqualificados', value: String(resumo.situacao.desqualificados) },
              ]}
            />
            <DetailCard
              title="Qualificação"
              description="Situação das decisões de qualificação registradas."
              icon={ListChecks}
              borderTone="border-l-4 border-l-amber-500"
              iconTone="text-amber-600 bg-amber-50"
              items={[
                { label: 'Pendentes', value: String(resumo.qualificacao.pendentes) },
                { label: 'Qualificadas', value: String(resumo.qualificacao.qualificadas) },
                { label: 'Desqualificadas', value: String(resumo.qualificacao.desqualificadas) },
              ]}
            />
            <DetailCard
              title="Valores e tickets"
              description="Valores monetários comprovados, apresentados em reais."
              icon={CircleDollarSign}
              borderTone="border-l-4 border-l-emerald-500"
              iconTone="text-emerald-600 bg-emerald-50"
              items={[
                {
                  label: 'Total precificado',
                  value: formatCurrency(resumo.valores.total_precificado_centavos),
                },
                {
                  label: 'Valor perdido',
                  value: formatCurrency(resumo.valores.perdido_centavos),
                },
                {
                  label: 'Ticket médio precificado',
                  value:
                    resumo.valores.ticket_medio_precificado_centavos === null
                      ? 'N/D'
                      : formatCurrency(resumo.valores.ticket_medio_precificado_centavos),
                },
                {
                  label: 'Ticket médio ganho',
                  value:
                    resumo.valores.ticket_medio_ganho_centavos === null
                      ? 'N/D'
                      : formatCurrency(resumo.valores.ticket_medio_ganho_centavos),
                },
              ]}
            />
            <DetailCard
              title="Negócios por modalidade"
              description="Quantidade e valor total dos negócios no período selecionado."
              icon={BriefcaseBusiness}
              borderTone="border-l-4 border-l-sky-500"
              iconTone="text-sky-600 bg-sky-50"
              items={resumo.modalidades.map((item) => ({
                label:
                  item.modalidade === 'recorrente'
                    ? 'Recorrente'
                    : item.modalidade === 'evento'
                      ? 'Evento'
                      : item.modalidade === 'serv_eventual'
                        ? 'Serv. Eventual'
                        : item.modalidade.replace(/_/g, ' '),
                value: `${item.quantidade} · ${formatCurrency(item.valor_centavos)}`,
              }))}
            />
            <DetailCard
              title="Qualidade dos dados"
              description="Cobertura e exceções relevantes do cadastro comercial."
              icon={ShieldCheck}
              borderTone="border-l-4 border-l-indigo-500"
              iconTone="text-indigo-600 bg-indigo-50"
              items={[
                {
                  label: 'Cobertura de origem',
                  value: formatPercent(resumo.cobertura.origem.percentual),
                },
                {
                  label: 'Origem preenchida',
                  value: `${resumo.cobertura.origem.preenchidos} de ${resumo.cobertura.origem.total}`,
                },
                {
                  label: 'Negócios com valor zero',
                  value: String(resumo.valores.negocios_valor_zero),
                },
                {
                  label: 'Marcadores de um centavo',
                  value: String(resumo.valores.negocios_marcador_um_centavo),
                },
              ]}
            />
            <DetailCard
              title="Negócios ganhos"
              description="Quantidade e valor dos ganhos no período, por modalidade."
              icon={Trophy}
              borderTone="border-l-4 border-l-emerald-500"
              iconTone="text-emerald-600 bg-emerald-50"
              items={[
                {
                  label: 'Total',
                  value: `${resumo.situacao.ganhos} · ${formatCurrency(resumo.valores.ganho_centavos)}`,
                },
                ...[
                  ['recorrente', 'Recorrente'],
                  ['evento', 'Evento'],
                  ['serv_eventual', 'Serv. Eventual'],
                ].map(([modalidade, label]) => {
                  const item = resumo.ganhos_por_modalidade.find(
                    (ganho) => ganho.modalidade === modalidade,
                  )
                  return {
                    label,
                    value: `${item?.quantidade ?? 0} · ${formatCurrency(item?.valor_centavos ?? 0)}`,
                  }
                }),
              ]}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <DistributionPieCard
              title="Negócios por fonte de prospecção"
              description="Distribuição da quantidade de negócios pela fonte registrada, respeitando os filtros aplicados."
              chartLabel="Gráfico de distribuição dos negócios por fonte de prospecção"
              emptyMessage="Nenhum negócio no período selecionado."
              items={fontesProspeccao}
            />
            <DistributionPieCard
              title="Negócios por responsável"
              description="Distribuição da quantidade de negócios pelos responsáveis, respeitando o escopo de acesso."
              chartLabel="Gráfico de distribuição dos negócios por responsável"
              emptyMessage="Nenhum negócio no período selecionado."
              items={negociosPorResponsavel}
            />
          </div>

          <Card
            aria-label="Motivos das perdas comerciais"
            className="rounded-xl border border-slate-200/80 border-l-4 border-l-rose-500 bg-white shadow-sm transition-all duration-150 hover:shadow-md hover:border-slate-300"
          >
            <CardHeader className="space-y-1 pb-3 border-b border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="rounded-lg p-1.5 text-rose-600 bg-rose-50">
                    <CircleX className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      Motivos das perdas comerciais
                    </CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Propostas perdidas no período, sem misturar desqualificações.
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="rounded-full border-rose-200/60 bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-700"
                >
                  Análise de perdas
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {perdasPorMotivo.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                  <p className="text-sm font-medium text-slate-700">
                    Nenhuma proposta perdida no período selecionado.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Excelente desempenho comercial no corte atual.
                  </p>
                </div>
              ) : (
                <div className="grid gap-5 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(20rem,1.2fr)] lg:items-center">
                  <div className="h-72" aria-label="Gráfico de distribuição dos motivos de perda">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={perdasPorMotivo}
                          dataKey="quantidade"
                          nameKey="motivo"
                          innerRadius={62}
                          outerRadius={102}
                          paddingAngle={2}
                        >
                          {perdasPorMotivo.map((item, index) => (
                            <Cell
                              key={item.motivo}
                              fill={LOSS_COLORS[index % LOSS_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            borderColor: '#e2e8f0',
                            borderRadius: '0.75rem',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            fontSize: '12px',
                          }}
                          formatter={(value: number | string | undefined) => [
                            `${Number(value ?? 0)} negócio(s)`,
                            'Quantidade',
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="space-y-2">
                    {perdasPorMotivo.map((item, index) => {
                      const total = perdasPorMotivo.reduce((sum, loss) => sum + loss.quantidade, 0)
                      const percentual = total ? (item.quantidade / total) * 100 : 0
                      return (
                        <li
                          key={item.motivo}
                          className="flex items-center justify-between gap-4 rounded-lg border border-slate-200/80 bg-white p-3 transition-colors hover:bg-slate-50/50"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: LOSS_COLORS[index % LOSS_COLORS.length] }}
                              aria-hidden="true"
                            />
                            <span className="truncate text-xs font-semibold text-slate-800">
                              {motivoPerdaLabel(item.motivo)}
                            </span>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-bold text-slate-900">
                              {item.quantidade} · {formatPercent(percentual)}
                            </p>
                            <p className="text-[11px] font-medium text-slate-500">
                              {formatCurrency(item.valor_centavos)}
                            </p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {data?.avisos?.length ? (
        <section
          aria-label="Observações dos indicadores"
          className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="rounded-lg bg-amber-50 p-1 text-amber-600">
              <AlertCircle className="h-4 w-4" />
            </span>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Observações do contrato
            </h2>
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-600">
            {data.avisos.map((aviso) => (
              <li key={aviso}>{aviso}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
