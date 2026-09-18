import { Link } from 'react-router-dom'
import {
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Sparkles,
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
      'Avalia a qualidade estratégica da carteira: recorrência e maior valor, com atenção especial para propostas recorrentes relevantes.',
    evolucao:
      'Como evoluir: priorizar oportunidades recorrentes, qualificar melhor o potencial de valor e manter propostas de maior impacto bem acompanhadas.',
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

function formatDate(date: string): string {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

function formatScore(score: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(score)
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
  return (
    <TooltipProvider delayDuration={120}>
      <section aria-label="IPCP educativo diário" className="space-y-4">
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-700 text-white hover:bg-emerald-700">
                Atualização diária
              </Badge>
              <Badge variant="outline">Base {formatDate(data.data_referencia)}</Badge>
              <Badge variant="outline">Produção assistida</Badge>
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
                <Sparkles className="h-5 w-5 text-emerald-700" /> Orientação do Nexo para hoje
              </CardTitle>
              <p className="mt-1 text-sm text-slate-600">
                Leitura viva da equipe atualizada diariamente
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-xl border border-emerald-200 bg-white p-4 text-sm leading-6 text-slate-800">
              {data.resumo_nexo.texto}
            </p>
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 font-semibold text-slate-950">
                  <Lightbulb className="h-4 w-4 text-amber-600" /> Prioridades do dia
                </h3>
                <div className="grid gap-3 md:grid-cols-3">
                  {data.resumo_nexo.prioridades.slice(0, 3).map((prioridade) => (
                    <div key={prioridade.titulo} className="rounded-xl border bg-white p-3">
                      <p className="text-sm font-semibold text-slate-950">{prioridade.titulo}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{prioridade.motivo}</p>
                      <Badge variant="outline" className="mt-3 text-xs">
                        {blocoLabels[prioridade.bloco_afetado]}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <h3 className="flex items-center gap-2 font-semibold text-slate-950">
                  <BookOpenCheck className="h-4 w-4 text-violet-700" /> IPCP do dia
                </h3>
                <p className="mt-3 text-4xl font-bold text-slate-950">
                  {formatScore(data.ipcp.total)}
                  <span className="text-base font-semibold text-slate-500">/100</span>
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Índice de Performance Comercial PMais — leitura assistida da rotina comercial.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  A nota é leitura secundária. A rotina deve priorizar as ações recomendadas.
                </p>
                <p className="mt-3 text-xs text-slate-600">
                  Follow-up IA: {data.ipcp.cobertura_ia.avaliados}/{data.ipcp.cobertura_ia.total}{' '}
                  avaliados
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-5 w-5 text-amber-600" /> Negócios que merecem atenção
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.negocios_atencao.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  Nenhum negócio específico foi destacado pelo IPCP nesta leitura. Use as
                  prioridades do dia e os cartões operacionais abaixo para conduzir a equipe.
                </div>
              ) : (
                data.negocios_atencao.map((item) => (
                  <div key={item.id_negocio} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          {nomeNegocioAtencao(item)}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{item.motivo}</p>
                      </div>
                      {item.link ? (
                        <Link
                          className="text-sm font-semibold text-violet-700 hover:underline"
                          to={item.link}
                        >
                          Abrir negócio
                        </Link>
                      ) : null}
                    </div>
                    <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                      {item.acao_recomendada}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.blocos_afetados.map((bloco) => (
                        <Badge key={bloco} variant="outline">
                          {blocoLabels[bloco]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5 text-emerald-700" /> Blocos IPCP
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(data.ipcp.blocos).map(([bloco, score]) => (
                <div
                  key={bloco}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <span className="flex items-center gap-2 text-sm text-slate-700">
                    {blocoLabels[bloco as IpcpBlocoId]}
                    <BlocoAjuda bloco={bloco as IpcpBlocoId} />
                  </span>
                  <span className="font-semibold text-slate-950">{formatScore(score)}</span>
                </div>
              ))}
              <div className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                {data.evolucao.comentario}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </TooltipProvider>
  )
}
