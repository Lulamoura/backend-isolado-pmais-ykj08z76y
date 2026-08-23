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
      const result = await simulateActiveCampaignReconciliation()
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
          Controle administrativo em duas fases. Simular não altera registros comerciais.
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
            Simular
          </Button>
          <Button onClick={execute} disabled={loading !== null || !simulation?.can_execute}>
            {loading === 'execute' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Executar plano simulado
          </Button>
        </div>

        {counts ? (
          <Alert variant={counts.conflict || counts.error ? 'destructive' : 'default'}>
            {counts.conflict || counts.error ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            <AlertTitle>Fingerprint {simulation.fingerprint.slice(0, 12)}…</AlertTitle>
            <AlertDescription>
              Criar: {counts.create}; atualizar: {counts.update}; sem mudança: {counts.unchanged};
              obsoletos: {counts.stale}; conflitos: {counts.conflict}; erros: {counts.error}.
              {simulation.can_execute
                ? ' O plano está apto para confirmação.'
                : ' A execução está bloqueada até resolver conflitos e erros.'}
            </AlertDescription>
          </Alert>
        ) : null}

        {execution ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Última reconciliação concluída</AlertTitle>
            <AlertDescription>
              Execução {execution.execution_id}; cursor confirmado{' '}
              {execution.cursor_to || 'inicial'}.
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}
