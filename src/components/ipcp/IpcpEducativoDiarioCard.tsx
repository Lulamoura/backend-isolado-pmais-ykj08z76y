import { Link } from 'react-router-dom'
import {
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Minus,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { IpcpDiarioReadOnly, IpcpBlocoId } from '@/services/ipcp'

const blocoLabels: Record<IpcpBlocoId, string> = {
  resultado_comercial: 'Resultado comercial',
  valor_estrategico: 'Valor estratégico',
  disciplina_carteira: 'Disciplina da carteira',
  qualidade_followup: 'Follow-up',
  registros_aprendizado: 'Registros/aprendizado',
}

const blocoExplicacoes: Record<
  IpcpBlocoId,
  {
    descricao: string
    evolucao: string
  }
> = {
  resultado_comercial: {
    descricao:
      'Mede o resultado efetivo do período: ganhos, conversão e valor convertido. Tem peso alto porque reflete fechamento comercial real.',
    evolucao:
      'Como evoluir: avançar propostas qualificadas, reduzir perdas por falta de retorno, melhorar taxa de conversão e converter negócios de maior valor.',
  },
  valor_estrategico: {
    descricao:
      'Avalia a qualidade estratégica da carteira: recorrência, alto valor e ganhos qualificados; proposta enviada sozinha não aumenta este bloco.',
    evolucao:
      'Como evoluir: priorizar oportunidades recorrentes, negócios de maior valor, recorrentes de alto valor e fechamentos qualificados.',
  },
  disciplina_carteira: {
    descricao:
      'Mede organização da carteira aberta: prazos, negócios antigos, próximas ações coerentes e ausência de oportunidades vencidas ou paradas.',
    evolucao:
      'Como evoluir: manter próxima ação realista, resolver negócios antigos, evitar datas distantes sem justificativa e tratar pendências dentro do prazo.',
  },
  qualidade_followup: {
    descricao:
      'Avalia a qualidade das notas de acompanhamento: decisor, objeção, pendência e próximo passo, além da clareza sobre avanço ou espera.',
    evolucao:
      'Como evoluir: registrar quem decidiu ou influenciou, qual objeção existe, qual pendência ficou aberta, o prazo combinado e o próximo contato objetivo.',
  },
  registros_aprendizado: {
    descricao:
      'Mede se os registros deixam aprendizado comercial: motivo de perda explicado, objeções documentadas e sinais úteis para melhorar a abordagem.',
    evolucao:
      'Como evoluir: registrar por que o cliente perdeu ou avançou, quais objeções se repetem e quais aprendizados podem orientar propostas futuras.',
  },
}

function formatScore(score: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(score)
}

function formatVariacao(value?: number | null): string {
  if (value === null || value === undefined) return '—'
  const formatted = formatScore(Math.abs(value))
  if (value > 0) return `+${formatted}`
  if (value < 0) return `-${formatted}`
  return '0,0'
}

function evolucaoStatusLabel(status: IpcpDiarioReadOnly['evolucao']['status']): string {
  if (status === 'melhorou') return 'Melhorou'
  if (status === 'piorou') return 'Recuou'
  if (status === 'manteve') return 'Estável'
  return 'Sem histórico'
}

function EvolucaoIcon({ status }: { status: IpcpDiarioReadOnly['evolucao']['status'] }) {
  if (status === 'melhorou') return <TrendingUp aria-hidden="true" className="h-4 w-4" />
  if (status === 'piorou') return <TrendingDown aria-hidden="true" className="h-4 w-4" />
  return <Minus aria-hidden="true" className="h-4 w-4" />
}

function evolucaoClassName(status: IpcpDiarioReadOnly['evolucao']['status']): string {
  if (status === 'melhorou') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'piorou') return 'border-rose-200 bg-rose-50 text-rose-700'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

function IpcpEvolucaoRelatorio({ data }: { data: IpcpDiarioReadOnly }) {
  const evolucao = data.evolucao
  const blocos = evolucao.blocos ?? []
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <EvolucaoIcon status={evolucao.status} /> Relatório evolutivo do IPCP
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Comparação educativa com a leitura diária anterior do mesmo escopo.
          </p>
        </div>
        <Badge className={evolucaoClassName(evolucao.status)} variant="outline">
          {evolucaoStatusLabel(evolucao.status)}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Atual</p>
          <p className="mt-1 text-lg font-bold text-slate-950">
            {evolucao.total_atual !== null && evolucao.total_atual !== undefined
              ? formatScore(evolucao.total_atual)
              : formatScore(data.ipcp.total)}
          </p>
        </div>
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Anterior</p>
          <p className="mt-1 text-lg font-bold text-slate-950">
            {evolucao.total_anterior !== null && evolucao.total_anterior !== undefined
              ? formatScore(evolucao.total_anterior)
              : '—'}
          </p>
        </div>
        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Variação</p>
          <p
            className={`mt-1 text-lg font-bold ${
              (evolucao.variacao_total ?? 0) > 0
                ? 'text-emerald-700'
                : (evolucao.variacao_total ?? 0) < 0
                  ? 'text-rose-700'
                  : 'text-slate-950'
            }`}
          >
            {formatVariacao(evolucao.variacao_total)}
          </p>
        </div>
      </div>

      <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
        {evolucao.comentario}
      </p>

      {blocos.length ? (
        <div className="mt-3 space-y-2">
          {blocos.slice(0, 5).map((bloco) => (
            <div key={bloco.id} className="flex items-center justify-between gap-3 rounded-lg border p-2">
              <span className="text-xs text-slate-600">{bloco.label}</span>
              <span
                className={`text-xs font-semibold ${
                  bloco.variacao > 0
                    ? 'text-emerald-700'
                    : bloco.variacao < 0
                      ? 'text-rose-700'
                      : 'text-slate-600'
                }`}
              >
                {formatVariacao(bloco.variacao)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function isIdTecnico(value: string): boolean {
  return /^[a-z0-9]{15}$/.test(String(value || ''))
}

function nomeNegocioAtencao(item: IpcpDiarioReadOnly['negocios_atencao'][number]): string {
  const cliente = String(item.cliente || '').trim()
  const id = String(item.id_negocio || '').trim()
  if (cliente && cliente !== 'Negócio comercial') return cliente
  if (id && !isIdTecnico(id)) return `Negócio ${id}`
  return 'Negócio comercial'
}

function numeroNegocioAtencao(item: IpcpDiarioReadOnly['negocios_atencao'][number]): string {
  return String(item.id_negocio || '').trim()
}

function BlocoAjuda({ bloco }: { bloco: IpcpBlocoId }) {
  const label = blocoLabels[bloco]
  const explicacao = blocoExplicacoes[bloco]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={`Explicar ${label}`}
          aria-description={`${explicacao.descricao} ${explicacao.evolucao}`}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          type="button"
        >
          <HelpCircle aria-hidden="true" className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm space-y-2 text-left leading-5" side="left">
        <p className="font-semibold">{label}</p>
        <p>{explicacao.descricao}</p>
        <p>{explicacao.evolucao}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export function IpcpEducativoDiarioCard({ data }: { data: IpcpDiarioReadOnly }) {
  const ipcpScore = data.ipcp.total
  const ipcpStatus =
    ipcpScore >= 70
      ? {
          border: 'border-l-4 border-l-emerald-500',
          valueTone: 'text-emerald-600',
          badge: {
            label: 'Saudável',
            className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
          },
        }
      : ipcpScore >= 50
        ? {
            border: 'border-l-4 border-l-amber-500',
            valueTone: 'text-amber-600',
            badge: {
              label: 'Atenção',
              className: 'bg-amber-50 text-amber-700 border-amber-200/60',
            },
          }
        : {
            border: 'border-l-4 border-l-rose-500',
            valueTone: 'text-rose-600',
            badge: {
              label: 'Comprometido',
              className: 'bg-rose-50 text-rose-700 border-rose-200/60',
            },
          }

  return (
    <TooltipProvider delayDuration={120}>
      <section aria-label="IPCP educativo diário" className="space-y-4">
        <Card className="border border-slate-200/80 bg-white shadow-sm border-l-4 border-l-emerald-500">
          <CardHeader className="space-y-1 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <Sparkles className="h-5 w-5 text-emerald-600" /> Orientação do Nexo para hoje
              </CardTitle>
              <Badge
                variant="outline"
                className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border-emerald-200/60"
              >
                Assistência IA
              </Badge>
            </div>
            <p className="text-xs text-slate-500">Leitura viva da equipe atualizada diariamente</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-4 text-sm leading-relaxed text-slate-700">
              {data.resumo_nexo.texto}
            </p>
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-2.5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Lightbulb className="h-4 w-4 text-amber-500" /> Prioridades do dia
                </h3>
                <div className="grid gap-3 md:grid-cols-3">
                  {data.resumo_nexo.prioridades.slice(0, 3).map((prioridade) => (
                    <div
                      key={prioridade.titulo}
                      className="flex flex-col justify-between rounded-lg border border-slate-200/80 border-l-4 border-l-amber-500 bg-white p-3 shadow-xs"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{prioridade.titulo}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{prioridade.motivo}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className="mt-3 w-fit text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border-slate-200"
                      >
                        {blocoLabels[prioridade.bloco_afetado]}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div
                className={`flex flex-col justify-between rounded-lg border border-slate-200/80 bg-white p-4 shadow-xs ${ipcpStatus.border}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <BookOpenCheck className="h-4 w-4 text-violet-600" /> IPCP do dia
                    </h3>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${ipcpStatus.badge.className}`}
                    >
                      {ipcpStatus.badge.label}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <p className={`text-3xl font-bold tracking-tight ${ipcpStatus.valueTone}`}>
                      {formatScore(data.ipcp.total)}
                    </p>
                    <span className="text-sm font-medium text-slate-400">/100</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 leading-normal">
                    Índice de Performance Comercial PMais — leitura assistida da rotina comercial.
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    A nota é leitura secundária. A rotina deve priorizar as ações recomendadas.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Follow-up IA</span>
                  <span className="font-semibold text-slate-700">
                    {data.ipcp.cobertura_ia.avaliados}/{data.ipcp.cobertura_ia.total} avaliados
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border border-slate-200/80 shadow-sm border-l-4 border-l-amber-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <CalendarClock className="h-5 w-5 text-amber-600" /> Negócios que merecem atenção
                </CardTitle>
                {data.negocios_atencao.length > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border-amber-200/60"
                  >
                    {data.negocios_atencao.length}{' '}
                    {data.negocios_atencao.length === 1 ? 'negócio' : 'negócios'}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.negocios_atencao.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4 text-xs leading-5 text-slate-500">
                  Nenhum negócio específico foi destacado pelo IPCP nesta leitura. Use as
                  prioridades do dia e os cartões operacionais abaixo para conduzir a equipe.
                </div>
              ) : (
                data.negocios_atencao.map((item) => (
                  <div
                    key={item.id_negocio}
                    className="rounded-lg border border-slate-200/80 bg-white p-3.5 shadow-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-slate-900">
                          {nomeNegocioAtencao(item)}
                        </p>
                        {numeroNegocioAtencao(item) ? (
                          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                            Nº do negócio: {numeroNegocioAtencao(item)}
                          </p>
                        ) : null}
                      </div>
                      {item.link ? (
                        <Link
                          className="text-xs font-medium text-violet-700 hover:text-violet-800 hover:underline"
                          to={item.link}
                        >
                          Abrir negócio
                        </Link>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-xs leading-normal text-slate-600">{item.motivo}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Empresa: {item.empresa || 'não informada'} · Contato:{' '}
                      {item.contato || 'não informado'}
                    </p>
                    <p className="mt-2.5 rounded-md bg-slate-50/80 border border-slate-100 p-2.5 text-xs leading-relaxed text-slate-700">
                      {item.acao_recomendada}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {item.blocos_afetados.map((bloco) => (
                        <Badge
                          key={bloco}
                          variant="outline"
                          className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border-slate-200"
                        >
                          {blocoLabels[bloco]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border border-slate-200/80 shadow-sm border-l-4 border-l-emerald-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Blocos IPCP
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border-slate-200"
                >
                  5 dimensões
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(data.ipcp.blocos).map(([bloco, score]) => {
                const scoreValue = Number(score)
                const isHealthy = scoreValue >= 14
                return (
                  <div
                    key={bloco}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/70 bg-white p-2.5 px-3 shadow-xs"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                      {blocoLabels[bloco as IpcpBlocoId]}
                      <BlocoAjuda bloco={bloco as IpcpBlocoId} />
                    </span>
                    <span
                      className={`text-xs font-semibold ${isHealthy ? 'text-emerald-600' : 'text-slate-800'}`}
                    >
                      {formatScore(score)}
                    </span>
                  </div>
                )
              })}
              <div className="rounded-lg bg-slate-50/80 border border-slate-100 p-3 text-xs leading-relaxed text-slate-600">
                {data.evolucao.comentario}
              </div>
              <IpcpEvolucaoRelatorio data={data} />
            </CardContent>
          </Card>
        </div>
      </section>
    </TooltipProvider>
  )
}
