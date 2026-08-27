import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listarSlas, type FilaSla, type FiltroSla } from '@/services/slas'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'
import { SlaParametrosDialog } from '@/components/SlaParametrosDialog'

const label = {
  vencido: 'Vencido',
  alerta: 'Em alerta',
  no_prazo: 'No prazo',
  nao_calculavel: 'SLA não calculável',
}

const etapaLabel: Record<string, string> = {
  prospects: 'Prospect',
  producao_proposta: 'Produção de Proposta',
  negociacao: 'Negociação',
}

function explicacao(item: FilaSla['itens'][number], antecedencia: number) {
  if (item.motivo_situacao === 'data_entrada_etapa_ausente')
    return 'Não calculável: data de entrada na fase ausente.'
  if (item.motivo_situacao === 'prazo_etapa_expirado') return 'Vencido: o prazo da fase expirou.'
  if (item.motivo_situacao === 'dentro_janela_alerta')
    return `Em alerta: vencimento dentro da janela de ${antecedencia} dia(s) útil(eis).`
  return 'No prazo: vencimento ainda fora da janela de alerta.'
}

export default function Slas() {
  const { isSuperAdmin } = useIsSuperAdmin()
  const [searchParams, setSearchParams] = useSearchParams()
  const filtro = (searchParams.get('situacao') || 'todas') as FiltroSla
  const [dados, setDados] = useState<FilaSla | null>(null)
  const [parametrosOpen, setParametrosOpen] = useState(false)
  const [erro, setErro] = useState(false)
  const carregar = useCallback(async () => setDados(await listarSlas(filtro)), [filtro])
  useEffect(() => {
    void carregar().catch(() => setErro(true))
  }, [carregar])
  const totais = dados?.totais ?? { vencido: 0, alerta: 0, no_prazo: 0, nao_calculavel: 0 }
  if (erro) return <p className="p-8 text-destructive">Não foi possível carregar os SLAs.</p>
  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">SLAs, calendário e alertas</h1>
        <p className="text-sm text-muted-foreground">
          Prazos da etapa calculados em dias úteis — America/Recife — não utilizam a data da próxima
          ação
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
      {dados && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Parâmetros vigentes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span>Prospect: {dados.parametros.lead} dia(s) útil(eis)</span>
            <span>Produção de Proposta: {dados.parametros.proposta} dia(s) útil(eis)</span>
            <span>Negociação: {dados.parametros.negociacao} dia(s) útil(eis)</span>
            <span>Alerta: {dados.parametros.antecedencia} dia(s) útil(eis) antes</span>
            {isSuperAdmin && (
              <Button size="sm" variant="outline" onClick={() => setParametrosOpen(true)}>
                Ajustar parâmetros
              </Button>
            )}
          </CardContent>
        </Card>
      )}
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
          {dados && dados.itens.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum SLA encontrado para este filtro. Ações vencidas são acompanhadas na fila de
              próximas ações.
            </p>
          )}
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
                  Fase: {etapaLabel[i.negocio.etapa] || i.negocio.etapa || 'não informada'} · Regra:{' '}
                  {i.dias_uteis} dia(s) útil(eis)
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
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  {explicacao(i, dados?.parametros.antecedencia ?? 1)}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      {dados && isSuperAdmin ? (
        <SlaParametrosDialog
          open={parametrosOpen}
          onOpenChange={setParametrosOpen}
          dados={dados}
          onSaved={carregar}
        />
      ) : null}
    </div>
  )
}
