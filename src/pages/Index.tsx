import { useEffect, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  BriefcaseBusiness,
  CircleDollarSign,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  Target,
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
}

function MetricCard({ title, value, detail, icon: Icon }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        <Icon className="h-4 w-4 text-violet-600" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tracking-tight text-slate-950">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{detail}</p>
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
}

function DetailCard({ title, description, items, icon: Icon }: DetailCardProps) {
  return (
    <Card aria-label={title}>
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-violet-600" aria-hidden="true" />
          <CardTitle className="text-base text-slate-900">{title}</CardTitle>
        </div>
        <p className="text-xs text-slate-500">{description}</p>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-slate-100">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-sm text-slate-600">{item.label}</dt>
              <dd className="text-sm font-semibold text-slate-950">{item.value}</dd>
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
    <Card aria-label={title}>
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="text-base text-slate-900">{title}</CardTitle>
        <p className="text-xs text-slate-500">{description}</p>
      </CardHeader>
      <CardContent>
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
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{
                        backgroundColor: DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length],
                      }}
                      aria-hidden="true"
                    />
                    <span className="truncate text-sm font-medium text-slate-800">
                      {item.label}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-950">
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
    <div
      aria-label="Carregando indicadores"
      className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-4 w-36" />
          </CardHeader>
          <CardContent className="space-y-2">
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
    incluir_inativos: false,
  })
  const [filters, setFilters] = useState<
    Pick<DashboardResumoParams, 'equipe_id' | 'responsavel_id' | 'modalidade' | 'incluir_inativos'>
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
      ...(draftFilters.incluir_inativos ? { incluir_inativos: true } : {}),
    })
  }

  function clearFilters() {
    setDraftFilters({
      equipe_id: 'todos',
      responsavel_id: 'todos',
      modalidade: 'todas',
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
    <main className="container mx-auto max-w-7xl space-y-5 px-4 py-5 animate-fade-in sm:py-6">
      <section className="rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-5 text-white shadow-lg sm:p-6">
        <div className="grid gap-4 md:grid-cols-[minmax(13rem,0.7fr)_minmax(28rem,1.3fr)] md:items-end">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
                Dashboard V1
              </Badge>
              {data?.escopo && (
                <Badge variant="outline" className="border-white/20 bg-black/10 text-violet-100">
                  Escopo: {data.escopo}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
              Visão comercial
              <span className="mt-0.5 block text-lg font-semibold text-violet-100 sm:text-xl">
                de {user?.name || 'Usuário'}
              </span>
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-snug text-violet-100/90">
              Indicadores do modelo canônico PMais, com datas civis de Recife e valores em reais.
            </p>
          </div>

          <form
            onSubmit={applyPeriod}
            className="grid gap-3 rounded-xl border border-white/20 bg-black/15 p-3 backdrop-blur-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <div className="space-y-1.5">
              <Label htmlFor="dashboard-inicio" className="text-xs text-violet-100">
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
                className="border-white/30 bg-white/10 text-white placeholder:text-violet-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dashboard-fim" className="text-xs text-violet-100">
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
                className="border-white/30 bg-white/10 text-white placeholder:text-violet-200"
              />
            </div>
            <Button
              type="submit"
              disabled={loading || draftPeriod.inicio > draftPeriod.fim}
              className="bg-white text-violet-900 hover:bg-violet-50 font-medium"
            >
              Aplicar período
            </Button>
          </form>
        </div>
      </section>

      <Card aria-labelledby="dashboard-filters-title">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-violet-600" aria-hidden="true" />
            <CardTitle id="dashboard-filters-title" className="text-base text-slate-900">
              Filtros de gestão
            </CardTitle>
          </div>
          <p className="text-xs text-slate-500">
            Refine os indicadores por equipe, responsável, modalidade e situação cadastral.
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={applyFilters}
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_0.8fr_auto_auto] xl:items-end"
          >
            <div className="space-y-1.5">
              <Label htmlFor="dashboard-equipe">Equipe</Label>
              <Select
                value={draftFilters.equipe_id}
                onValueChange={(value) =>
                  setDraftFilters((current) => ({ ...current, equipe_id: value }))
                }
              >
                <SelectTrigger id="dashboard-equipe" aria-label="Equipe">
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
              <Label htmlFor="dashboard-modalidade">Modalidade</Label>
              <Select
                value={draftFilters.modalidade}
                onValueChange={(value) =>
                  setDraftFilters((current) => ({ ...current, modalidade: value }))
                }
              >
                <SelectTrigger id="dashboard-modalidade" aria-label="Modalidade">
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
              <Label htmlFor="dashboard-responsavel">Responsável</Label>
              <Select
                value={draftFilters.responsavel_id}
                onValueChange={(value) =>
                  setDraftFilters((current) => ({ ...current, responsavel_id: value }))
                }
              >
                <SelectTrigger id="dashboard-responsavel" aria-label="Responsável">
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

            <div className="flex min-h-10 items-center gap-2 rounded-md border px-3 py-2">
              <Switch
                id="dashboard-inativos"
                checked={draftFilters.incluir_inativos}
                onCheckedChange={(checked) =>
                  setDraftFilters((current) => ({ ...current, incluir_inativos: checked }))
                }
              />
              <Label htmlFor="dashboard-inativos" className="cursor-pointer text-sm">
                Incluir negócios inativos
              </Label>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                Aplicar filtros
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={clearFilters}
                disabled={loading || Object.keys(filters).length === 0}
              >
                <X className="mr-2 h-4 w-4" /> Limpar
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
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          <MetricCard
            title="Negócios no período"
            value={String(resumo.total)}
            detail={`${resumo.situacao.abertos} abertos`}
            icon={BriefcaseBusiness}
          />
          <MetricCard
            title="Carteira aberta"
            value={formatCurrency(resumo.valores.carteira_aberta_centavos)}
            detail={`${resumo.valores.negocios_precificados} negócios precificados`}
            icon={Target}
          />
          <MetricCard
            title="Negócios ganhos"
            value={String(resumo.situacao.ganhos)}
            detail={formatCurrency(resumo.valores.ganho_centavos)}
            icon={Trophy}
          />
          <MetricCard
            title="Conversão global"
            value={formatPercent(resumo.conversoes.global_percentual)}
            detail="Ganhos sobre decisões registradas"
            icon={Target}
          />
          <MetricCard
            title="Conversão qualitativa"
            value={formatPercent(resumo.conversoes.qualitativa_percentual ?? null)}
            detail={`${formatCurrency(resumo.valores.ganho_centavos)} ganhos de ${formatCurrency(resumo.conversoes.decisoes_valor_centavos ?? 0)} em decisões`}
            icon={CircleDollarSign}
          />
          <MetricCard
            title="Taxa de qualificação"
            value={formatPercent(resumo.conversoes.qualificacao_percentual)}
            detail={`${resumo.qualificacao.qualificadas} qualificados`}
            icon={UserCheck}
          />
          <MetricCard
            title="Cobertura de responsável"
            value={formatPercent(resumo.cobertura.responsavel.percentual)}
            detail={`${resumo.cobertura.responsavel.preenchidos} de ${resumo.cobertura.responsavel.total} negócios`}
            icon={UserCheck}
          />
        </section>
      ) : null}

      {resumo ? (
        <section aria-labelledby="dashboard-details-title" className="space-y-4">
          <div>
            <h2 id="dashboard-details-title" className="text-lg font-bold text-slate-950">
              Detalhamento comercial
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Composição, valores e qualidade cadastral do período selecionado.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DetailCard
              title="Composição dos negócios"
              description="Distribuição pelo resultado canônico atual."
              icon={BriefcaseBusiness}
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

          <Card aria-label="Motivos das perdas comerciais">
            <CardHeader className="space-y-1 pb-3">
              <CardTitle className="text-base text-slate-900">
                Motivos das perdas comerciais
              </CardTitle>
              <p className="text-xs text-slate-500">
                Propostas perdidas no período, sem misturar desqualificações.
              </p>
            </CardHeader>
            <CardContent>
              {perdasPorMotivo.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">
                  Nenhuma proposta perdida no período selecionado.
                </p>
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
                          className="flex items-center justify-between gap-4 rounded-lg border p-3"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-3 w-3 shrink-0 rounded-full"
                              style={{ backgroundColor: LOSS_COLORS[index % LOSS_COLORS.length] }}
                              aria-hidden="true"
                            />
                            <span className="truncate text-sm font-medium text-slate-800">
                              {motivoPerdaLabel(item.motivo)}
                            </span>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-slate-950">
                              {item.quantidade} · {formatPercent(percentual)}
                            </p>
                            <p className="text-xs text-slate-500">
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
          className="rounded-xl border bg-slate-50 p-4"
        >
          <h2 className="text-sm font-semibold text-slate-800">Observações do contrato</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
            {data.avisos.map((aviso) => (
              <li key={aviso}>{aviso}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}
