import { Link } from 'react-router-dom'
import { ArrowUpRight, ClipboardCheck, FileCheck2, ListChecks, Trophy } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'

const stages = [
  {
    step: 1,
    title: 'Qualificação',
    description: 'Decidir se a oportunidade avança para a produção da proposta.',
    path: '/qualificacao',
    icon: ListChecks,
    iconTone: 'text-amber-600 bg-amber-50',
    borderTone: 'border-l-4 border-l-amber-500',
    statusBadge: {
      label: 'Triagem',
      className: 'bg-amber-50 text-amber-700 border-amber-200/60',
    },
    actionHint: 'Acessar qualificação',
  },
  {
    step: 2,
    title: 'Propostas',
    description: 'Preparar, aprovar, emitir e registrar a decisão da proposta.',
    path: '/propostas',
    icon: FileCheck2,
    iconTone: 'text-sky-600 bg-sky-50',
    borderTone: 'border-l-4 border-l-sky-500',
    statusBadge: {
      label: 'Negociação',
      className: 'bg-sky-50 text-sky-700 border-sky-200/60',
    },
    actionHint: 'Acessar propostas',
  },
  {
    step: 3,
    title: 'Fechamentos',
    description: 'Registrar ganho, perda e agenda de recuperação futura.',
    path: '/fechamentos',
    icon: Trophy,
    iconTone: 'text-emerald-600 bg-emerald-50',
    borderTone: 'border-l-4 border-l-emerald-500',
    statusBadge: {
      label: 'Decisão',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    },
    actionHint: 'Acessar fechamentos',
  },
  {
    step: 4,
    title: 'Ordens de Execução',
    description: 'Concluir o handoff dos ganhos para a operação.',
    path: '/ordens-execucao',
    icon: ClipboardCheck,
    iconTone: 'text-sky-600 bg-sky-50',
    borderTone: 'border-l-4 border-l-sky-500',
    statusBadge: {
      label: 'Handoff',
      className: 'bg-sky-50 text-sky-700 border-sky-200/60',
    },
    actionHint: 'Acessar ordens de execução',
  },
]

export default function Pipeline() {
  const { perfilSlug } = useIsSuperAdmin()
  const visibleStages =
    perfilSlug === 'negociacao-propria'
      ? stages.filter((stage) => ['/propostas', '/fechamentos'].includes(stage.path))
      : stages

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Jornada comercial
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Pipeline Comercial
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
          As etapas permanecem conectadas pelo mesmo negócio e pela mesma trilha auditável.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {visibleStages.map((stage) => {
          const Icon = stage.icon
          return (
            <Link
              key={stage.path}
              to={stage.path}
              className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <Card
                className={`h-full border border-slate-200/80 bg-white shadow-sm transition-all duration-150 hover:border-slate-300 hover:shadow-md ${stage.borderTone}`}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="flex items-center gap-3">
                    <span className={`rounded-lg p-2 ${stage.iconTone}`}>
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        ETAPA {stage.step}
                      </p>
                      <CardTitle className="text-base font-semibold text-slate-900 group-hover:text-violet-700 transition-colors">
                        {stage.title}
                      </CardTitle>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${stage.statusBadge.className}`}
                  >
                    {stage.statusBadge.label}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="text-sm text-slate-600 leading-relaxed">{stage.description}</p>
                  <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 group-hover:text-violet-700 transition-colors">
                      {stage.actionHint}
                      <ArrowUpRight
                        aria-hidden="true"
                        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
