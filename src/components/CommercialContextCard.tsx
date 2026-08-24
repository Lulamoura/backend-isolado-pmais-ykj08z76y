import { AlertTriangle, Building2, CalendarClock, Contact, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  actionStatus,
  ageInDays,
  formatDate,
  formatMoney,
  type CommercialContext,
} from '@/lib/commercial-context'

const stageLabels: Record<string, string> = {
  prospects: 'Prospects',
  producao_proposta: 'Produção de proposta',
  negociacao: 'Negociação',
}

export function CommercialContextCard({
  contexto,
  etapa,
}: {
  contexto: CommercialContext
  etapa: string
}) {
  const status = actionStatus(contexto.proxima_acao_em)
  const age = ageInDays(contexto.crm_created_at)
  const alerts = [
    status === 'vencida' ? 'Próxima ação vencida' : '',
    status === 'ausente' ? 'Sem próxima ação' : '',
    !contexto.responsavel ? 'Sem responsável' : '',
  ].filter(Boolean)
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <p className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          {contexto.empresa?.nome || 'Empresa não informada'}
        </p>
        <p className="flex items-center gap-2">
          <Contact className="h-4 w-4 text-muted-foreground" />
          {contexto.contato?.nome || 'Contato não informado'}
        </p>
        <p className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-muted-foreground" />
          {contexto.responsavel?.name || 'Responsável não informado'}
        </p>
        <p className="font-semibold">{formatMoney(contexto.valor_centavos)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{contexto.fase_crm || stageLabels[etapa] || etapa}</Badge>
        {contexto.modalidade && <Badge variant="outline">{contexto.modalidade}</Badge>}
        {age !== null && <Badge variant="secondary">{age} dia(s) de vida</Badge>}
      </div>
      <div className="rounded-md border bg-muted/30 p-3">
        <p className="flex items-center gap-2 font-medium">
          <CalendarClock className="h-4 w-4" />
          Próxima ação: {formatDate(contexto.proxima_acao_em)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Situação: {status} · CRM atualizado em {formatDate(contexto.crm_updated_at)}
        </p>
        {contexto.fonte_prospeccao && (
          <p className="mt-1 text-xs text-muted-foreground">Fonte: {contexto.fonte_prospeccao}</p>
        )}
      </div>
      {alerts.length > 0 && (
        <div className="flex items-start gap-2 text-xs font-medium text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          {alerts.join(' · ')}
        </div>
      )}
      {contexto.somente_leitura && (
        <p className="text-xs text-muted-foreground">
          Base real em somente leitura durante a pré-operação.
        </p>
      )}
    </div>
  )
}
