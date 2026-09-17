import { Link } from 'react-router-dom'
import { BookOpenCheck, CalendarClock, CheckCircle2, Lightbulb, Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { IpcpDiarioReadOnly, IpcpBlocoId } from '@/services/ipcp'

const blocoLabels: Record<IpcpBlocoId, string> = {
  resultado_comercial: 'Resultado comercial',
  valor_estrategico: 'Valor estratégico',
  disciplina_carteira: 'Disciplina da carteira',
  qualidade_followup: 'Follow-up',
  registros_aprendizado: 'Registros/aprendizado',
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

export function IpcpEducativoDiarioCard({ data }: { data: IpcpDiarioReadOnly }) {
  return (
    <section aria-label="IPCP educativo diário" className="space-y-4">
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-emerald-700 text-white hover:bg-emerald-700">
              Atualização diária
            </Badge>
            <Badge variant="outline">Base {formatDate(data.data_referencia)}</Badge>
            <Badge variant="outline">Indicador educativo</Badge>
          </div>
          <div>
            <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
              <Sparkles className="h-5 w-5 text-emerald-700" /> Orientação do Nexo para hoje
            </CardTitle>
            <p className="mt-1 text-sm text-slate-600">Indicador educativo atualizado diariamente</p>
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
            {data.negocios_atencao.map((item) => (
              <div key={item.id_negocio} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Negócio {item.id_negocio} — {item.cliente}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.motivo}</p>
                  </div>
                  {item.link ? (
                    <Link className="text-sm font-semibold text-violet-700 hover:underline" to={item.link}>
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
            ))}
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
              <div key={bloco} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span className="text-sm text-slate-700">{blocoLabels[bloco as IpcpBlocoId]}</span>
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
  )
}
