import pb from '@/lib/pocketbase/client'

export interface ReconciliationCounts {
  create: number
  update: number
  unchanged: number
  stale: number
  conflict: number
  error: number
}

export interface ReconciliationSimulation {
  mode: 'incremental' | 'initial_open_negotiation' | 'synthetic'
  dry_run_id: string
  fingerprint: string
  cursor_from: string | null
  cursor_to: string | null
  expires_at: string
  counts: ReconciliationCounts
  can_execute: boolean
}

export interface ReconciliationExecution extends ReconciliationSimulation {
  execution_id: string
  status: 'completed' | 'replayed'
  replay: boolean
}

export interface ActiveCampaignConfigStatus {
  webhook_enabled: boolean
  reconciliation_enabled: boolean
  synthetic_gate_enabled: boolean
  cursor: string
}

export const simulateActiveCampaignReconciliation = (
  mode: 'incremental' | 'initial_open_negotiation' = 'incremental',
) =>
  pb.send<ReconciliationSimulation>('/backend/v1/integracao/ac/reconciliacao/simular', {
    method: 'POST',
    body: JSON.stringify({ mode }),
    headers: { 'Content-Type': 'application/json' },
  })

export const executeActiveCampaignReconciliation = (
  simulation: ReconciliationSimulation,
  commandId: string,
) =>
  pb.send<ReconciliationExecution>('/backend/v1/integracao/ac/reconciliacao/executar', {
    method: 'POST',
    body: JSON.stringify({
      dry_run_id: simulation.dry_run_id,
      fingerprint: simulation.fingerprint,
      confirmation: 'RECONCILIAR ACTIVECAMPAIGN',
      command_idempotency_key: commandId,
    }),
    headers: { 'Content-Type': 'application/json' },
  })

export const newReconciliationCommandId = () => `ac-reconcile:${crypto.randomUUID()}`.slice(0, 128)

export const getActiveCampaignConfigStatus = () =>
  pb.send<ActiveCampaignConfigStatus>('/backend/v1/integracao/ac/configuracao/status', {
    method: 'GET',
  })

export const setActiveCampaignReconciliationGate = (action: 'open' | 'close') =>
  pb.send<ActiveCampaignConfigStatus>('/backend/v1/integracao/ac/configuracao/reconciliacao-real', {
    method: 'POST',
    body: JSON.stringify({
      action,
      confirmation:
        action === 'open'
          ? 'ATIVAR RECONCILIACAO REAL ACTIVECAMPAIGN'
          : 'DESATIVAR RECONCILIACAO REAL ACTIVECAMPAIGN',
      command_idempotency_key: `t6-ac-reconciliation-${crypto.randomUUID()}`.slice(0, 128),
    }),
    headers: { 'Content-Type': 'application/json' },
  })
