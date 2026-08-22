import { useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Flag,
  Database,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { runRound2D2B, type Round2D2BResult } from '@/services/porta-2d2b'

const MONITORED_COLLECTIONS = [
  { key: 'contatos', label: 'com_contatos', expected: 1 },
  { key: 'negocios', label: 'com_negocios', expected: 2 },
  { key: 'eventos', label: 'com_eventos_integracao', expected: 5 },
  { key: 'execucoes', label: 'com_execucoes_sincronizacao', expected: 4 },
  { key: 'vinculos', label: 'com_vinculos_externos', expected: 3 },
  { key: 'snapshots', label: 'com_snapshots_negocio', expected: 1 },
  { key: 'ocorrencias', label: 'com_ocorrencias_qualidade', expected: 1 },
  { key: 'auditoria', label: 'com_auditoria', expected: 0 },
]

export function Porta2D2BEvidenceBlock() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Round2D2BResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRun = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await runRound2D2B()
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute round')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Porta 2D.2B — Round Execution
          </CardTitle>
          <CardDescription>
            Single authorized execution of the 16-call synthetic round validating ac_webhook.js and
            ac_rollback.js end-to-end. Uses exclusively [TESTE] synthetic samples. No external
            calls. No real data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleRun} disabled={loading} className="w-full sm:w-auto">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executing Round...
              </>
            ) : (
              'Run Porta 2D.2B Round'
            )}
          </Button>
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Execution Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Overall Result</span>
                <Badge variant={result.go_no_go === 'GO' ? 'default' : 'destructive'}>
                  {result.go_no_go}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Status:</span>{' '}
                  <span
                    className={cn(
                      'font-medium',
                      result.overall_status === 'PASS' ? 'text-green-600' : 'text-red-600',
                    )}
                  >
                    {result.overall_status}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Calls:</span>{' '}
                  <span className="font-medium">{result.total_calls} / 16</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Correlation Key:</span>{' '}
                  <code className="text-xs">{result.correlation_key}</code>
                </div>
                <div>
                  <span className="text-muted-foreground">External Calls:</span>{' '}
                  <span className="font-medium">{result.activecampaign_calls}</span>
                </div>
              </div>
              {result.stop_reason && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Stop Reason</AlertTitle>
                  <AlertDescription className="font-mono text-xs">
                    {result.stop_reason}
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Flag className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Flag sequence:</span>
                <code className="text-xs">
                  {result.flag_before?.valor ?? 'null'} → {result.flag_during?.valor ?? 'null'} →{' '}
                  {result.flag_final?.valor ?? 'null'}
                </code>
                {result.flag_final?.valor === 'false' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Call Results ({result.calls.length} / 16)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Call</TableHead>
                    <TableHead className="w-20">Method</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead className="w-20">Expected</TableHead>
                    <TableHead className="w-20">Actual</TableHead>
                    <TableHead className="w-16">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.calls.map((call) => (
                    <TableRow key={call.call}>
                      <TableCell className="font-mono font-medium">{call.call}</TableCell>
                      <TableCell className="font-mono text-xs">{call.method}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {call.url}
                      </TableCell>
                      <TableCell className="font-mono">{call.expected_status}</TableCell>
                      <TableCell className="font-mono">{call.actual_status}</TableCell>
                      <TableCell>
                        {call.passed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Delta Validation
              </CardTitle>
              <CardDescription>
                Expected vs observed deltas across all monitored collections.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Collection</TableHead>
                    <TableHead className="w-24">Initial</TableHead>
                    <TableHead className="w-24">Final</TableHead>
                    <TableHead className="w-24">Delta</TableHead>
                    <TableHead className="w-24">Expected</TableHead>
                    <TableHead className="w-16">Match</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MONITORED_COLLECTIONS.map((col) => {
                    const initial = result.counts_before[col.key] ?? -1
                    const final = result.counts_after[col.key] ?? -1
                    const delta = result.deltas[col.key] ?? 0
                    const match = delta === col.expected
                    return (
                      <TableRow key={col.key}>
                        <TableCell className="font-mono text-xs">{col.label}</TableCell>
                        <TableCell className="font-mono">{initial}</TableCell>
                        <TableCell className="font-mono">{final}</TableCell>
                        <TableCell className="font-mono">+{delta}</TableCell>
                        <TableCell className="font-mono">+{col.expected}</TableCell>
                        <TableCell>
                          {match ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <Badge variant={result.delta_match ? 'default' : 'destructive'}>
                  {result.delta_match ? 'All deltas match' : 'Delta mismatch detected'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {result.evidence_ids.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Evidence Ledger (Sanitized IDs)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {result.evidence_ids.map((ev, i) => (
                    <Badge key={i} variant="secondary" className="font-mono text-xs">
                      {ev.collection}:{ev.id}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Private Audit Artifact</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
