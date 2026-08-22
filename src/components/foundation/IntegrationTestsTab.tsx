import { useState } from 'react'
import { ShieldCheck, Play, Loader2, AlertTriangle, GitCommit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  runRound,
  runPrecheck,
  runRoundR5,
  type RoundResult,
  type PrecheckResult,
  type R5Result,
} from '@/services/integration-tests'
import { RoundEvidence } from '@/components/foundation/RoundEvidence'
import { RoundEvidenceBlock } from '@/components/foundation/RoundEvidenceBlock'
import { R9EvidenceBlock } from '@/components/foundation/R9EvidenceBlock'
import { R10EvidenceBlock } from '@/components/foundation/R10EvidenceBlock'
import { R11EvidenceBlock } from '@/components/foundation/R11EvidenceBlock'
import { R12EvidenceBlock } from '@/components/foundation/R12EvidenceBlock'
import { R13EvidenceBlock } from '@/components/foundation/R13EvidenceBlock'
import { DiagTransportEvidenceBlock } from '@/components/foundation/DiagTransportEvidenceBlock'
import { DiagCompensacaoAuditEvidenceBlock } from '@/components/foundation/DiagCompensacaoAuditEvidenceBlock'

export function IntegrationTestsTab() {
  const [loading, setLoading] = useState<string | null>(null)
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null)
  const [precheckResult, setPrecheckResult] = useState<PrecheckResult | null>(null)
  const [r5Result, setR5Result] = useState<R5Result | null>(null)

  const handleRoundR5 = async () => {
    setLoading('r5')
    try {
      const result = await runRoundR5()
      setR5Result(result)
      if (result.overall_status === 'PASS') {
        toast.success('R5 Round concluído — PASS')
      } else {
        toast.error(`R5 Round: ${result.overall_status} — ${result.stop_reason || ''}`)
      }
    } catch {
      toast.error('Erro ao executar R5 round')
    } finally {
      setLoading(null)
    }
  }

  const handlePrecheck = async () => {
    setLoading('precheck')
    try {
      const result = await runPrecheck()
      setPrecheckResult(result)
      toast.success(result.message)
    } catch {
      toast.error('Erro ao executar precheck')
    } finally {
      setLoading(null)
    }
  }

  const handleRound = async (mode: 'security-only' | 'full') => {
    setLoading(mode)
    try {
      const result = await runRound(mode)
      setRoundResult(result)
      if (result.stopReason) {
        toast.error(`Round parou: ${result.stopReason}`)
      } else if (result.securityMatrixPassed) {
        toast.success(`Round ${mode} concluído — matriz 100% PASS`)
      } else {
        toast.warning(`Round ${mode} — matriz não passou`)
      }
    } catch {
      toast.error('Erro ao executar round')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Testes de Integração ActiveCampaign</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={handlePrecheck} disabled={!!loading} variant="outline" size="sm">
              {loading === 'precheck' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Pre-check
            </Button>
            <Button
              onClick={() => handleRound('security-only')}
              disabled={!!loading}
              variant="outline"
              size="sm"
            >
              {loading === 'security-only' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Security-Only
            </Button>
            <Button onClick={() => handleRound('full')} disabled={!!loading} size="sm">
              {loading === 'full' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Full Round (R4)
            </Button>
            <Button onClick={handleRoundR5} disabled={!!loading} variant="outline" size="sm">
              {loading === 'r5' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Full Round (R5)
            </Button>
          </div>

          {precheckResult && (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                {precheckResult.ready ? (
                  <ShieldCheck className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
                <span className="font-medium">Pre-check</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                {Object.entries(precheckResult.secrets).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-1">
                    <Badge variant={val === 'PRESENTE' ? 'default' : 'destructive'}>{val}</Badge>
                    <span className="text-xs">{key}</span>
                  </div>
                ))}
              </div>
              {precheckResult.hs256Test && (
                <div className="text-sm">
                  hs256: {precheckResult.hs256Test.passed ? '✅ PASS' : '❌ FAIL'}
                </div>
              )}
            </div>
          )}

          {r5Result && (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={r5Result.overall_status === 'PASS' ? 'default' : 'destructive'}>
                  {r5Result.overall_status}
                </Badge>
                <span className="font-medium">R5 Round</span>
              </div>
              <div className="text-sm space-y-1">
                <div>
                  Correlation: <code className="text-xs">{r5Result.correlation_key}</code>
                </div>
                <div>Matrix: {r5Result.security_matrix.length} tests</div>
                <div>
                  Flag Final: valor={r5Result.flag_final?.valor}, ativo=
                  {r5Result.flag_final?.ativo?.toString()}
                </div>
                <div>Probe: {r5Result.final_webhook_probe_status}</div>
                <div>AC Calls: {r5Result.activecampaign_calls}</div>
                <div>Evidence: {r5Result.evidence_ids.length} records</div>
                {r5Result.stop_reason && (
                  <div className="text-red-500">Stop: {r5Result.stop_reason}</div>
                )}
              </div>
            </div>
          )}

          {roundResult && <RoundEvidence result={roundResult} />}
        </CardContent>
      </Card>

      <RoundEvidenceBlock
        roundLabel="R6"
        routePath="/backend/v1/integracao/ac/run-round-2d2a-r6"
        sessionKey="r6_evidence_raw"
        disabled={!!loading}
        onStart={() => setLoading('r6')}
        onEnd={() => setLoading(null)}
      />

      <RoundEvidenceBlock
        roundLabel="R7"
        routePath="/backend/v1/integracao/ac/run-round-2d2a-r7"
        sessionKey="r7_evidence_raw"
        disabled={!!loading}
        onStart={() => setLoading('r7')}
        onEnd={() => setLoading(null)}
      />

      <RoundEvidenceBlock
        roundLabel="R8"
        routePath="/backend/v1/integracao/ac/run-round-2d2a-r8"
        sessionKey="r8_evidence_raw"
        disabled={!!loading}
        onStart={() => setLoading('r8')}
        onEnd={() => setLoading(null)}
      />

      <R9EvidenceBlock />

      <R10EvidenceBlock />

      <R11EvidenceBlock />

      <R12EvidenceBlock />

      <R13EvidenceBlock />

      <DiagTransportEvidenceBlock />

      <DiagCompensacaoAuditEvidenceBlock />

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground font-mono py-2">
        <GitCommit className="h-3 w-3" />
        <span>Bundle version: R13-DIAG-COMPENSACAO-AUDITORIA-FRONTEND-20260812-v2</span>
      </div>
    </div>
  )
}
