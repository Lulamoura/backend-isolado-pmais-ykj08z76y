import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listarSlas, type FilaSla, type FiltroSla } from '@/services/slas'

const label = {
  vencido: 'Vencido',
  alerta: 'Em alerta',
  no_prazo: 'No prazo',
  nao_calculavel: 'SLA não calculável',
}
export default function Slas() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filtro = (searchParams.get('situacao') || 'todas') as FiltroSla
  const [dados, setDados] = useState<FilaSla | null>(null)
  const [erro, setErro] = useState(false)
  useEffect(() => {
    void listarSlas(filtro)
      .then(setDados)
      .catch(() => setErro(true))
  }, [filtro])
  const totais = useMemo(
    () => ({
      vencido: dados?.itens.filter((i) => i.situacao === 'vencido').length ?? 0,
      alerta: dados?.itens.filter((i) => i.situacao === 'alerta').length ?? 0,
      no_prazo: dados?.itens.filter((i) => i.situacao === 'no_prazo').length ?? 0,
      nao_calculavel: dados?.itens.filter((i) => i.situacao === 'nao_calculavel').length ?? 0,
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
      <div className="flex flex-wrap gap-2" aria-label="Filtros de SLA">
        {(
          [
            ['atencao', 'Atenção e vencidos'],
            ['vencido', 'Vencidos'],
            ['alerta', 'Em alerta'],
            ['no_prazo', 'No prazo'],
            ['nao_calculavel', 'Não calculável'],
            ['todas', 'Todos'],
          ] as Array<[FiltroSla, string]>
        ).map(([value, text]) => (
          <Button
            key={value}
            size="sm"
            variant={filtro === value ? 'default' : 'outline'}
            onClick={() => setSearchParams(value === 'todas' ? {} : { situacao: value })}
          >
            {text}
          </Button>
        ))}
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
                <p className="font-medium">
                  {i.negocio.external_id ? `Negócio AC #${i.negocio.external_id} — ` : ''}
                  {i.negocio.empresa?.nome || i.negocio.titulo}
                </p>
                <p className="text-xs text-muted-foreground">
                  {i.negocio.etapa} · {i.dias_uteis} dia(s) útil(eis)
                </p>
                <p className="text-xs text-muted-foreground">
                  Responsável: {i.negocio.responsavel?.nome || 'não informado'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Marco da etapa:{' '}
                  {i.marco_inicial
                    ? new Date(i.marco_inicial).toLocaleString('pt-BR')
                    : 'não comprovado'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Próxima ação:{' '}
                  {i.proxima_acao_em
                    ? new Date(i.proxima_acao_em).toLocaleString('pt-BR')
                    : 'não informada'}
                </p>
              </div>
              <div className="text-right">
                <Badge variant={i.situacao === 'vencido' ? 'destructive' : 'secondary'}>
                  {label[i.situacao]}
                </Badge>
                <p className="mt-1 text-xs">
                  {i.vence_em
                    ? new Date(i.vence_em).toLocaleString('pt-BR')
                    : 'Sem vencimento calculado'}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
