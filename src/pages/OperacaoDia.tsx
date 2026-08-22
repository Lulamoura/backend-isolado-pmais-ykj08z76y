import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  EyeOff,
  RefreshCw,
  Trophy,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listarFilaAtividades } from '@/services/atividades'
import { listarFechamentos } from '@/services/fechamentos'
import { listarOrdensExecucao } from '@/services/ordens-execucao'
import { listarSlas } from '@/services/slas'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'

type OperationSummary = {
  semProximaAcao: number
  acoesVencidas: number
  slasVencidos: number
  slasAlerta: number
  aguardandoOe: number
  recuperacoes: number
}

const EMPTY: OperationSummary = {
  semProximaAcao: 0,
  acoesVencidas: 0,
  slasVencidos: 0,
  slasAlerta: 0,
  aguardandoOe: 0,
  recuperacoes: 0,
}

export default function OperacaoDia() {
  const { perfilSlug } = useIsSuperAdmin()
  const [summary, setSummary] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [partialError, setPartialError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.allSettled([
      listarFilaAtividades('todas'),
      listarSlas(),
      perfilSlug === 'negociacao-propria'
        ? Promise.resolve({ itens: [], responsaveis_envio: [] })
        : listarOrdensExecucao(),
      listarFechamentos(),
    ]).then((results) => {
      if (!active) return
      const [activities, slas, orders, closings] = results
      setPartialError(results.some((result) => result.status === 'rejected'))
      setSummary({
        semProximaAcao:
          activities.status === 'fulfilled'
            ? activities.value.itens.filter((item) => item.situacao === 'sem_proxima_acao').length
            : 0,
        acoesVencidas:
          activities.status === 'fulfilled'
            ? activities.value.itens.filter((item) => item.situacao === 'vencida').length
            : 0,
        slasVencidos:
          slas.status === 'fulfilled'
            ? slas.value.itens.filter((item) => item.situacao === 'vencido').length
            : 0,
        slasAlerta:
          slas.status === 'fulfilled'
            ? slas.value.itens.filter((item) => item.situacao === 'alerta').length
            : 0,
        aguardandoOe:
          orders.status === 'fulfilled'
            ? orders.value.itens.filter((item) => item.estado_operacional === 'aguardando_oe')
                .length
            : 0,
        recuperacoes:
          closings.status === 'fulfilled'
            ? closings.value.itens.filter((item) => item.agenda?.estado === 'ativa').length
            : 0,
      })
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [perfilSlug, reloadKey])

  const cards = [
    {
      title: 'Próximas ações',
      value: summary.semProximaAcao + summary.acoesVencidas,
      detail: `${summary.semProximaAcao} sem ação · ${summary.acoesVencidas} vencida(s)`,
      path: '/atividades',
      icon: CalendarClock,
      tone: 'text-rose-700 bg-rose-50',
    },
    {
      title: 'SLAs em atenção',
      value: summary.slasVencidos + summary.slasAlerta,
      detail: `${summary.slasVencidos} vencido(s) · ${summary.slasAlerta} em alerta`,
      path: '/slas',
      icon: AlertTriangle,
      tone: 'text-amber-700 bg-amber-50',
    },
    {
      title: 'Ganhos aguardando OE',
      value: summary.aguardandoOe,
      detail: 'Handoff comercial pendente',
      path: '/ordens-execucao',
      icon: ClipboardCheck,
      tone: 'text-indigo-700 bg-indigo-50',
    },
    {
      title: 'Oportunidades para recuperar',
      value: summary.recuperacoes,
      detail: 'Agendas de recuperação ativas',
      path: '/fechamentos',
      icon: Trophy,
      tone: 'text-emerald-700 bg-emerald-50',
    },
  ].filter((card) => perfilSlug !== 'negociacao-propria' || card.path !== '/ordens-execucao')

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-lg">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-300">
            Prioridades e exceções
          </p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight">Operação do Dia</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Comece pelos itens que exigem ação. Cada cartão abre a fila operacional correspondente.
          </p>
        </div>
        <Button
          variant="secondary"
          className="gap-2"
          disabled={loading}
          onClick={() => setReloadKey((value) => value + 1)}
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" /> Atualizar
        </Button>
      </section>

      {partialError && (
        <Alert>
          <AlertTriangle aria-hidden="true" className="h-4 w-4" />
          <AlertTitle>Resumo parcialmente disponível</AlertTitle>
          <AlertDescription>
            Uma das filas não respondeu. Os demais números continuam disponíveis e podem ser
            atualizados.
          </AlertDescription>
        </Alert>
      )}

      <section aria-label="Filas prioritárias" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.title} to={card.path}>
              <Card className="h-full transition hover:border-indigo-300 hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">{card.title}</CardTitle>
                  <span className={`rounded-lg p-2 ${card.tone}`}>
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-950">{loading ? '—' : card.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{card.detail}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </section>

      <Card className="border-dashed">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-slate-100 p-2 text-slate-600">
              <EyeOff aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-slate-900">Leitura de propostas: Não rastreável</p>
              <p className="mt-1 text-sm text-slate-600">
                A Provelo não oferece integração no momento. Nenhuma abertura será inferida ou
                simulada.
              </p>
            </div>
          </div>
          <Link to="/propostas" className="text-sm font-semibold text-indigo-700 hover:underline">
            Ver propostas emitidas
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
