import pb from '@/lib/pocketbase/client'

export interface CallResult {
  call: string
  method: string
  url: string
  expected_status: number
  actual_status: number
  response: string
  counts_before: Record<string, number>
  counts_after: Record<string, number>
  passed: boolean
}

export interface FlagState {
  valor: string | null
  ativo: boolean | null
  error: string | null
}

export interface Round2D2BResult {
  porta: string
  correlation_key: string
  started_at: string
  finished_at: string
  overall_status: string
  go_no_go: string
  stop_reason: string | null
  calls: CallResult[]
  counts_before: Record<string, number>
  counts_after: Record<string, number>
  deltas: Record<string, number>
  expected_deltas: Record<string, number>
  delta_match: boolean
  flag_before: FlagState
  flag_during: FlagState | null
  flag_final: FlagState | null
  final_probe_status: number | null
  evidence_ids: Array<{ collection: string; id: string }>
  activecampaign_calls: number
  synthetic_only: boolean
  records_removed: boolean
  single_execution: boolean
  total_calls: number
}

export const runRound2D2B = (): Promise<Round2D2BResult> =>
  pb.send('/backend/v1/integracao/ac/run-round-2d2b', { method: 'POST' })
