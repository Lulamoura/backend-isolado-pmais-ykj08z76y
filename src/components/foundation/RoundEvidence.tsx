import { CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { RoundResult } from '@/services/integration-tests'

export function RoundEvidence({ result }: { result: RoundResult }) {
  const passed = result.securityMatrix.filter((t) => t.passed).length
  const total = result.securityMatrix.length

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={result.securityMatrixPassed ? 'default' : 'destructive'}>
            Matrix: {passed}/{total}
          </Badge>
          <Badge variant={result.deactivationProof?.pass ? 'default' : 'destructive'}>
            Webhook: {result.deactivationProof?.pass ? 'Disabled' : 'Active'}
          </Badge>
          <Badge variant={result.flagFinal ? 'destructive' : 'outline'}>
            Flag Final: {String(result.flagFinal)}
          </Badge>
          {result.stopReason && <Badge variant="destructive">STOP: {result.stopReason}</Badge>}
        </div>
        <div className="text-sm text-muted-foreground">
          Correlation: {result.correlationKey} | Mode: {result.mode}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Actual</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.securityMatrix.map((t, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{t.test}</TableCell>
                  <TableCell>{t.expected}</TableCell>
                  <TableCell>{t.actual}</TableCell>
                  <TableCell>
                    {t.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {result.functionalResults && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Functional Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(result.functionalResults).map(([key, val]) => {
                const v = val as Record<string, unknown>
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between text-sm border-b pb-1"
                  >
                    <span className="font-mono text-xs">{key}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">status: {String(v.status)}</span>
                      {v.pass ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {result.evidenceLedger && result.evidenceLedger.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evidence Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Collection</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Correlation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.evidenceLedger.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{e.collection}</TableCell>
                    <TableCell className="font-mono text-xs">{e.id}</TableCell>
                    <TableCell className="text-xs">{e.created}</TableCell>
                    <TableCell className="font-mono text-xs">{e.correlationKey}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Collection Counts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Collection</TableHead>
                <TableHead>Before</TableHead>
                <TableHead>After</TableHead>
                <TableHead>Delta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.keys(result.beforeCounts).map((key) => {
                const before = result.beforeCounts[key] ?? 0
                const after = result.afterCounts[key] ?? 0
                const delta = after - before
                return (
                  <TableRow key={key}>
                    <TableCell className="font-mono text-xs">{key}</TableCell>
                    <TableCell>{before}</TableCell>
                    <TableCell>{after}</TableCell>
                    <TableCell
                      className={delta > 0 ? 'text-green-500' : delta < 0 ? 'text-red-500' : ''}
                    >
                      {delta > 0 ? `+${delta}` : delta}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
