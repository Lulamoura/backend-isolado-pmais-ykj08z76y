import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listarSlas, type FilaSla, type FiltroSla } from '@/services/slas'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'
import { SlaParametrosDialog } from '@/components/SlaParametrosDialog'
import { CommercialContextCard } from '@/components/CommercialContextCard'
import { commercialActionCardClass, type CommercialContext } from '@/lib/commercial-context'

const label = {
  vencido: 'Vencido',
  alerta: 'Em alerta',
  no_prazo: 'No prazo',
  nao_calculavel: 'SLA não calculável',
}

function explicacao(item: FilaSla['itens'][number], antecedencia: number) {
  if (item.motivo_situacao === 'acao_vencida_fora_tolerancia')
    return `SLA crítico: ação vencida há ${item.dias_atraso_uteis} dia(s) útil(eis).`
  if (item.motivo_situacao === 'acao_vencida_dentro_tolerancia')
    return `Ação vencida há ${item.dias_atraso_uteis} dia(s) útil(eis), dentro da tolerância.`
  if (item.motivo_situacao === 'acao_para_hoje') return 'Em dia: próxima ação prevista para hoje.'
  if (item.motivo_situacao === 'acao_programada') return 'Em dia: próxima ação futura programada.'
  if (item.motivo_situacao === 'sem_acao_fora_tolerancia')
    return 'SLA crítico: negociação permanece sem próxima ação além da tolerância.'
  if (item.motivo_situacao === 'sem_acao_dentro_tolerancia')
    return 'Atenção: negociação sem próxima ação, ainda dentro da tolerância.'
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
          Prospect e proposta usam prazo da etapa. Na negociação, o SLA crítico começa após a
          tolerância de dias úteis sobre a próxima ação vencida — calendário America/Recife.
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
            <span>
              Negociação: crítico após {dados.parametros.negociacao} dia(s) útil(eis) de atraso
            </span>
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
      {dados && dados.itens.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <p className="font-semibold">Nenhum SLA encontrado para este filtro</p>
            <p className="text-sm text-muted-foreground">
              Ações vencidas são acompanhadas na fila de próximas ações.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(dados?.itens ?? []).map((i) => {
            const contextoPadrao: CommercialContext = i.contexto || {
              external_id: i.negocio.external_id,
              empresa: i.negocio.empresa,
              contato: null,
              responsavel: i.negocio.responsavel
                ? { id: i.negocio.responsavel.id, name: i.negocio.responsavel.nome }
                : null,
              valor_centavos: 0,
              modalidade: null,
              fase_crm: null,
              fonte_prospeccao: null,
              proxima_acao_em: i.proxima_acao_em,
              crm_created_at: null,
              crm_updated_at: null,
              origem_canal: null,
              somente_leitura: false,
            }
            return (
              <Card
                key={i.negocio.id}
                className={commercialActionCardClass(
                  i.proxima_acao_em || contextoPadrao.proxima_acao_em,
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{i.negocio.titulo}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Regra:{' '}
                        {i.negocio.etapa === 'negociacao'
                          ? `crítico após ${i.dias_uteis} dia(s) útil(eis) de atraso`
                          : `${i.dias_uteis} dia(s) útil(eis)`}
                      </p>
                    </div>
                    <Badge variant={i.situacao === 'vencido' ? 'destructive' : 'secondary'}>
                      {label[i.situacao]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CommercialContextCard
                    contexto={contextoPadrao}
                    etapa={i.negocio.etapa}
                    negocioId={i.negocio.id}
                  />
                  <div className="rounded-md border bg-slate-50/80 p-3 text-xs space-y-1">
                    <p className="font-medium text-slate-800">
                      Situação do SLA: {label[i.situacao]}
                    </p>
                    <p className="text-muted-foreground">
                      Marco inicial:{' '}
                      {i.marco_inicial
                        ? new Date(i.marco_inicial).toLocaleString('pt-BR')
                        : 'não comprovado'}
                    </p>
                    <p className="text-muted-foreground">
                      Vencimento:{' '}
                      {i.vence_em
                        ? i.negocio.etapa === 'negociacao'
                          ? `Crítico em ${i.vence_em.slice(0, 10).split('-').reverse().join('/')}`
                          : new Date(i.vence_em).toLocaleString('pt-BR')
                        : 'Sem vencimento calculado'}
                    </p>
                    <p className="text-muted-foreground">
                      {explicacao(i, dados?.parametros.antecedencia ?? 1)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
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
