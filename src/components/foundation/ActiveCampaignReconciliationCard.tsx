import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  executeActiveCampaignReconciliation,
  getActiveCampaignConfigStatus,
  setActiveCampaignReconciliationGate,
  newReconciliationCommandId,
  simulateActiveCampaignReconciliation,
  type ActiveCampaignConfigStatus,
  type ReconciliationExecution,
  type ReconciliationSimulation,
} from '@/services/ac-reconciliation'

function formatCursor(value?: string | null) {
  if (!value || value === 'UNINITIALIZED') return 'não consultado'
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (match) return `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}`
  return value
}

function formatReconciliationError(error: unknown) {
  const data = (error as { data?: { error?: string; detail?: string }; message?: string })?.data
  const code = data?.error || (error as { message?: string })?.message || ''
  if (code === 'FINGERPRINT_OBSOLETO') {
    return 'Plano vencido ou alterado. Rode Verificar atualizações novamente e confirme o novo plano gerado.'
  }
  if (code === 'REVALIDACAO_FALHOU') {
    return 'O ActiveCampaign não respondeu à checagem final. Rode Verificar atualizações novamente antes de confirmar.'
  }
  if (code === 'PLANO_BLOQUEADO') {
    return 'O plano tem conflito crítico. Abra a lista de pendências, corrija o cadastro indicado e rode nova verificação.'
  }
  if (code === 'RECONCILIACAO_EM_ANDAMENTO') {
    return 'Já existe uma reconciliação em andamento. Aguarde a conclusão e atualize a tela.'
  }
  return data?.detail || code || 'A execução foi recusada sem detalhe técnico retornado.'
}

export function ActiveCampaignReconciliationCard() {
  const [loading, setLoading] = useState<'simulate' | 'execute' | null>(null)
  const [simulation, setSimulation] = useState<ReconciliationSimulation | null>(null)
  const [execution, setExecution] = useState<ReconciliationExecution | null>(null)
  const [executionError, setExecutionError] = useState<string | null>(null)
  const [status, setStatus] = useState<ActiveCampaignConfigStatus | null>(null)

  useEffect(() => {
    getActiveCampaignConfigStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])

  const setGate = async (action: 'open' | 'close') => {
    setLoading('execute')
    try {
      const result = await setActiveCampaignReconciliationGate(action)
      setStatus(result)
      setSimulation(null)
      setExecution(null)
      setExecutionError(null)
      toast.success(
        action === 'open'
          ? 'Reconciliação manual habilitada.'
          : 'Reconciliação manual desabilitada.',
      )
    } catch {
      toast.error('Não foi possível alterar o gate da reconciliação.')
    } finally {
      setLoading(null)
    }
  }

  const simulate = async () => {
    setLoading('simulate')
    setSimulation(null)
    setExecution(null)
    setExecutionError(null)
    try {
      const result = await simulateActiveCampaignReconciliation('incremental')
      setSimulation(result)
      toast.success('Simulação concluída sem escrita comercial.')
    } catch {
      toast.error('Não foi possível simular a reconciliação.')
    } finally {
      setLoading(null)
    }
  }

  const execute = async () => {
    if (!simulation?.can_execute) return
    const toastId = toast.loading('Aplicando reconciliação ActiveCampaign...')
    setLoading('execute')
    try {
      const result = await executeActiveCampaignReconciliation(
        simulation,
        newReconciliationCommandId(),
      )
      setExecution(result)
      setExecutionError(null)
      setSimulation(null)
      setStatus((current) =>
        current
          ? {
              ...current,
              cursor: result.cursor_to || current.cursor,
            }
          : current,
      )
      toast.success('Reconciliação concluída e auditada.', { id: toastId })
    } catch (error) {
      const message = formatReconciliationError(error)
      setExecutionError(message)
      toast.error(message, { id: toastId })
    } finally {
      setLoading(null)
    }
  }

  const counts = simulation?.counts
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" /> Reconciliação ActiveCampaign
        </CardTitle>
        <CardDescription>
          Habilite sob demanda, verifique as atualizações e só então confirme a reconciliação. A
          verificação não altera registros comerciais.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border p-3 text-sm text-muted-foreground">
          Estado: {status?.reconciliation_enabled ? 'habilitada para uso manual' : 'desabilitada'} ·
          cursor: {formatCursor(status?.cursor)}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={status?.reconciliation_enabled ? 'outline' : 'default'}
            onClick={() => void setGate(status?.reconciliation_enabled ? 'close' : 'open')}
            disabled={loading !== null}
          >
            {status?.reconciliation_enabled
              ? 'Desabilitar reconciliação'
              : 'Habilitar reconciliação'}
          </Button>
          <Button
            variant="outline"
            onClick={simulate}
            disabled={loading !== null || !status?.reconciliation_enabled}
          >
            {loading === 'simulate' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Verificar atualizações
          </Button>
          <Button
            onClick={execute}
            disabled={
              loading !== null || !status?.reconciliation_enabled || !simulation?.can_execute
            }
          >
            {loading === 'execute' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Confirmar reconciliação
          </Button>
        </div>

        {counts ? (
          <Alert variant={counts.conflict ? 'destructive' : 'default'}>
            {counts.conflict ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            <AlertTitle>Resultado da verificação</AlertTitle>
            <AlertDescription>
              <div>
                Novos: {counts.create}; atualizações: {counts.update}; sem alteração:{' '}
                {counts.unchanged}; pendências: {counts.conflict + counts.error}.
                {simulation.can_execute
                  ? ' A reconciliação pode ser confirmada.'
                  : ' A confirmação está bloqueada até resolver as pendências.'}
              </div>
              {counts.conflict + counts.error > 0 ? (
                <div className="mt-2 space-y-2">
                  <div>
                    <strong>Pendências operacionais:</strong> Você pode confirmar agora os registros
                    válidos. Depois, corrija cadastro de empresa, contato ou responsável comercial
                    apenas a partir de Fazer Proposta no ActiveCampaign ou no mapeamento do
                    Aplicativo Comercial e rode nova verificação.
                  </div>
                  {simulation.pending_issues?.length ? (
                    <ul className="list-disc space-y-1 pl-5">
                      {simulation.pending_issues.map((item) => (
                        <li key={`${item.id_negocio}-${item.motivo}`}>
                          <strong>Nº do negócio {item.id_negocio}:</strong>{' '}
                          {item.titulo || 'Sem título'} — {item.motivo}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        {executionError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Motivo da recusa</AlertTitle>
            <AlertDescription>{executionError}</AlertDescription>
          </Alert>
        ) : null}

        {execution ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Última reconciliação concluída</AlertTitle>
            <AlertDescription>
              As atualizações do ActiveCampaign foram aplicadas e o acompanhamento foi atualizado.
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}
