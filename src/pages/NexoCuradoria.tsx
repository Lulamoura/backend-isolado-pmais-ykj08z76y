import { useEffect, useState } from 'react'
import { AlertCircle, MessageSquareText } from 'lucide-react'

import NexoCuradoriaComercialUnificada from '@/components/nexo/NexoCuradoriaComercialUnificada'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'
import {
  obterHistoricoDecisoesSuperioresCuradoriaNexo,
  type NexoCuradoriaDecisaoSuperior,
} from '@/services/nexo-curadoria'

function dataCurta(value?: string) {
  if (!value) return 'sem data'
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return 'sem data'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function resumoDecisao(decisao: NexoCuradoriaDecisaoSuperior) {
  return [
    decisao.empresa_nome || decisao.negocio_titulo || 'Empresa não informada',
    decisao.contato_nome || 'Contato não informado',
    decisao.external_id ? `Negócio ${decisao.external_id}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

function rotuloStatus(status?: string) {
  if (status === 'aprovada_uso_operacional') return 'Aprovada para uso operacional'
  if (status === 'rejeitada') return 'Rejeitada'
  return 'Registro histórico'
}

export default function NexoCuradoria() {
  const { perfilSlug } = useIsSuperAdmin()
  const somenteLeitura = perfilSlug === 'leitura-executiva'
  const podeVerHistoricoLegado =
    perfilSlug === 'superadministrador' || perfilSlug === 'leitura-executiva'
  const [historico, setHistorico] = useState<NexoCuradoriaDecisaoSuperior[]>([])
  const [erroHistorico, setErroHistorico] = useState(false)

  useEffect(() => {
    let ativo = true
    if (!podeVerHistoricoLegado) {
      setHistorico([])
      setErroHistorico(false)
      return () => {
        ativo = false
      }
    }

    obterHistoricoDecisoesSuperioresCuradoriaNexo(20)
      .then((itens) => {
        if (!ativo) return
        setHistorico(itens)
        setErroHistorico(false)
      })
      .catch(() => {
        if (!ativo) return
        setHistorico([])
        setErroHistorico(true)
      })

    return () => {
      ativo = false
    }
  }, [podeVerHistoricoLegado])

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Inteligência Comercial PMais · Governança
          </p>
          <h2 className="mt-1 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700 shadow-sm">
              <MessageSquareText aria-hidden="true" className="h-5 w-5" />
            </span>
            Curadoria Comercial
          </h2>
          <p className="mt-1.5 text-sm text-slate-600">
            Evidências comerciais passam por revisão humana antes de se tornarem conhecimento
            operacional.
          </p>
        </div>
        <Badge
          variant="outline"
          className="rounded-full border-violet-200/80 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700"
        >
          Curadoria do conhecimento operacional
        </Badge>
      </section>

      <NexoCuradoriaComercialUnificada somenteLeitura={perfilSlug === 'leitura-executiva'} />

      {podeVerHistoricoLegado && (
        <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            Histórico legado somente leitura ({historico.length})
          </summary>
          <p className="mt-2 text-xs text-slate-500">
            Registros anteriores foram preservados apenas para consulta. Edição, sincronização e
            revisão IPCP não estão disponíveis neste fluxo.
          </p>
          {erroHistorico && (
            <Alert variant="destructive" className="mt-3 rounded-xl">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>Histórico indisponível</AlertTitle>
              <AlertDescription>
                Não foi possível carregar os registros históricos agora.
              </AlertDescription>
            </Alert>
          )}
          {!erroHistorico && historico.length === 0 && (
            <p className="mt-3 text-xs text-slate-500">Nenhum registro legado encontrado.</p>
          )}
          <div className="mt-3 space-y-2">
            {historico.map((decisao) => (
              <article
                key={decisao.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{resumoDecisao(decisao)}</p>
                  <Badge variant="outline" className="bg-white text-[11px] text-slate-600">
                    {rotuloStatus(decisao.status)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {dataCurta(decisao.updated_at || decisao.created_at || decisao.created)}
                </p>
                {decisao.regra_proposta && (
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                    {decisao.regra_proposta}
                  </p>
                )}
              </article>
            ))}
          </div>
        </details>
      )}

      {somenteLeitura && (
        <p className="sr-only">Leitura executiva opera esta página em modo somente leitura.</p>
      )}
    </div>
  )
}
