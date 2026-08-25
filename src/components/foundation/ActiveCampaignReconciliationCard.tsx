import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  executeActiveCampaignReconciliation,
  newReconciliationCommandId,
  simulateActiveCampaignReconciliation,
  type ReconciliationExecution,
  type ReconciliationSimulation,
} from '@/services/ac-reconciliation'

export function ActiveCampaignReconciliationCard() {
  const [loading, setLoading] = useState<'simulate' | 'execute' | null>(null)
  const [simulation, setSimulation] = useState<ReconciliationSimulation | null>(null)
  const [execution, setExecution] = useState<ReconciliationExecution | null>(null)

  const simulate = async () => {
    setLoading('simulate')
    setSimulation(null)
    setExecution(null)
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
    const total = simulation.counts.create + simulation.counts.update
    if (!window.confirm(`Executar o plano simulado e aplicar ${total} alteração(ões)?`)) return
    setLoading('execute')
    try {
      const result = await executeActiveCampaignReconciliation(
        simulation,
        newReconciliationCommandId(),
      )
      setExecution(result)
      setSimulation(null)
      toast.success('Reconciliação concluída e auditada.')
    } catch {
      toast.error('Execução recusada ou interrompida com segurança.')
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
          Verifique as atualizações disponíveis antes de confirmar a reconciliação. A verificação
          não altera registros comerciais.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={simulate} disabled={loading !== null}>
            {loading === 'simulate' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Verificar atualizações
          </Button>
          <Button onClick={execute} disabled={loading !== null || !simulation?.can_execute}>
            {loading === 'execute' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Confirmar reconciliação
          </Button>
        </div>

        {counts ? (
          <Alert variant={counts.conflict || counts.error ? 'destructive' : 'default'}>
            {counts.conflict || counts.error ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            <AlertTitle>Resultado da verificação</AlertTitle>
            <AlertDescription>
              Novos: {counts.create}; atualizações: {counts.update}; sem alteração:{' '}
              {counts.unchanged}; pendências: {counts.conflict + counts.error}.
              {simulation.can_execute
                ? ' A reconciliação pode ser confirmada.'
                : ' A confirmação está bloqueada até resolver as pendências.'}
            </AlertDescription>
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
