import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listarSlas, type FilaSla } from '@/services/slas'

const label = { vencido: 'Vencido', alerta: 'Em alerta', no_prazo: 'No prazo' }
export default function Slas() {
  const [dados, setDados] = useState<FilaSla | null>(null)
  const [erro, setErro] = useState(false)
  useEffect(() => {
    void listarSlas()
      .then(setDados)
      .catch(() => setErro(true))
  }, [])
  const totais = useMemo(
    () => ({
      vencido: dados?.itens.filter((i) => i.situacao === 'vencido').length ?? 0,
      alerta: dados?.itens.filter((i) => i.situacao === 'alerta').length ?? 0,
      no_prazo: dados?.itens.filter((i) => i.situacao === 'no_prazo').length ?? 0,
    }),
    [dados],
  )
  if (erro) return <p className="p-8 text-destructive">Não foi possível carregar os SLAs.</p>
  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">SLAs, calendário e alertas</h1>
        <p className="text-sm text-muted-foreground">
          Prazos calculados em dias úteis — America/Recife
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="text-rose-600" />
            <div>
              <b>{totais.vencido}</b>
              <p className="text-xs">Vencidos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock3 className="text-amber-600" />
            <div>
              <b>{totais.alerta}</b>
              <p className="text-xs">Em alerta</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="text-emerald-600" />
            <div>
              <b>{totais.no_prazo}</b>
              <p className="text-xs">No prazo</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Agenda de vencimentos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(dados?.itens ?? []).map((i) => (
            <div
              key={i.negocio.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div>
                <p className="font-medium">{i.negocio.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {i.negocio.etapa} · {i.dias_uteis} dia(s) útil(eis)
                </p>
              </div>
              <div className="text-right">
                <Badge variant={i.situacao === 'vencido' ? 'destructive' : 'secondary'}>
                  {label[i.situacao]}
                </Badge>
                <p className="mt-1 text-xs">{new Date(i.vence_em).toLocaleString('pt-BR')}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
