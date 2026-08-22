import { Link } from 'react-router-dom'
import { ClipboardCheck, FileCheck2, ListChecks, Trophy } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'

const stages = [
  {
    title: 'Qualificação',
    description: 'Decidir se a oportunidade avança para a produção da proposta.',
    path: '/qualificacao',
    icon: ListChecks,
  },
  {
    title: 'Propostas',
    description: 'Preparar, aprovar, emitir e registrar a decisão da proposta.',
    path: '/propostas',
    icon: FileCheck2,
  },
  {
    title: 'Fechamentos',
    description: 'Registrar ganho, perda e agenda de recuperação futura.',
    path: '/fechamentos',
    icon: Trophy,
  },
  {
    title: 'Ordens de Execução',
    description: 'Concluir o handoff dos ganhos para a operação.',
    path: '/ordens-execucao',
    icon: ClipboardCheck,
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
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
          Jornada comercial
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-950">Pipeline Comercial</h2>
        <p className="mt-1 text-sm text-slate-600">
          As etapas permanecem conectadas pelo mesmo negócio e pela mesma trilha auditável.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {visibleStages.map((stage, index) => {
          const Icon = stage.icon
          return (
            <Link key={stage.path} to={stage.path} className="group">
              <Card className="h-full transition hover:border-indigo-300 hover:shadow-md">
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-400">ETAPA {index + 1}</p>
                    <CardTitle className="text-lg group-hover:text-indigo-700">
                      {stage.title}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">{stage.description}</CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
