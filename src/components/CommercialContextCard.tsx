import { AlertTriangle, Building2, CalendarClock, Contact, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { BusinessNotesDialog } from '@/components/BusinessNotesDialog'
import {
  actionStatus,
  ageInDays,
  formatDate,
  formatMoney,
  followUpPendente,
  type CommercialContext,
} from '@/lib/commercial-context'

const stageLabels: Record<string, string> = {
  prospects: 'Prospects',
  producao_proposta: 'Produção de proposta',
  negociacao: 'Negociação',
}

const commercialLabel = (value: string) => {
  if (value === 'serv_eventual') return 'Serv. Eventual'
  const normalized = value.replace(/_/g, ' ').trim()
  return normalized ? normalized.charAt(0).toLocaleUpperCase('pt-BR') + normalized.slice(1) : value
}

export function CommercialContextCard({
  contexto,
  etapa,
  negocioId,
  showNextAction = true,
  showReadOnlyNotice = true,
}: {
  contexto: CommercialContext
  etapa: string
  negocioId?: string
  showNextAction?: boolean
  showReadOnlyNotice?: boolean
}) {
  const status = actionStatus(contexto.proxima_acao_em)
  const nextActionClass =
    status === 'vencida'
      ? 'border-rose-300 bg-rose-50'
      : status === 'ausente'
        ? 'border-amber-300 bg-amber-50'
        : 'border-emerald-300 bg-emerald-50'
  const age = ageInDays(contexto.crm_created_at)
  const hasPendingFollowUp =
    contexto.follow_up_pendente ??
    followUpPendente(contexto.proxima_acao_reagendada_em, contexto.ultima_nota_em)
  const alerts = [
    showNextAction && status === 'vencida' ? 'Próxima ação vencida' : '',
    showNextAction && status === 'ausente' ? 'Sem próxima ação' : '',
    !contexto.responsavel ? 'Sem responsável' : '',
  ].filter(Boolean)
  return (
    <div className="space-y-3 text-sm">
      {contexto.external_id && (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Negócio AC #{contexto.external_id}
        </p>
      )}
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
        {contexto.modalidade && (
          <Badge variant="outline">{commercialLabel(contexto.modalidade)}</Badge>
        )}
        {age !== null && <Badge variant="secondary">{age} dia(s) de vida</Badge>}
      </div>
      {showNextAction ? (
        <div className={`rounded-md border p-3 ${nextActionClass}`}>
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
      ) : (
        <p className="text-xs text-muted-foreground">
          CRM atualizado em {formatDate(contexto.crm_updated_at)}
          {contexto.fonte_prospeccao ? ` · Fonte: ${contexto.fonte_prospeccao}` : ''}
        </p>
      )}
      {hasPendingFollowUp && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Follow-up pendente — Data da Ação reagendada sem nota nova.</span>
        </div>
      )}
      {alerts.length > 0 && (
        <div className="flex items-start gap-2 text-xs font-medium text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          {alerts.join(' · ')}
        </div>
      )}
      {negocioId && <BusinessNotesDialog negocioId={negocioId} />}
      {showReadOnlyNotice && contexto.somente_leitura && (
        <p className="text-xs text-muted-foreground">
          Base real em somente leitura durante a pré-operação.
        </p>
      )}
    </div>
  )
}
