import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, RefreshCw } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CommercialContextCard } from '@/components/CommercialContextCard'
import { formatDate } from '@/lib/commercial-context'
import { NexoBusinessActions } from '@/components/NexoBusinessActions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  listarOrdensExecucao,
  novaChaveOE,
  registrarOrdemExecucao,
  type ItemOE,
  type ResponsavelOE,
} from '@/services/ordens-execucao'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'

export type EstadoOrdemExecucao = 'todos' | ItemOE['estado_operacional']

export const normalizarEstadoOrdemExecucao = (estado: string | null): EstadoOrdemExecucao =>
  estado === 'aguardando_oe' || estado === 'em_processo_de_entrega' ? estado : 'todos'

export const filtrarOrdensExecucao = (
  itens: ItemOE[],
  estado: EstadoOrdemExecucao,
  periodoInicio: string,
  periodoFim: string,
) =>
  itens.filter((item) => {
    const data = item.negocio.data_periodo?.slice(0, 10) || ''
    const dentroDoPeriodo =
      (!periodoInicio || data >= periodoInicio) && (!periodoFim || data <= periodoFim)
    return dentroDoPeriodo && (estado === 'todos' || item.estado_operacional === estado)
  })

export default function OrdensExecucao() {
  const { perfilSlug } = useIsSuperAdmin()
  const somenteLeitura = perfilSlug === 'leitura-executiva'
  const [itens, setItens] = useState<ItemOE[]>([])
  const [responsaveis, setResponsaveis] = useState<ResponsavelOE[]>([])
  const [loading, setLoading] = useState(true)
  const [numero, setNumero] = useState<Record<string, string>>({})
  const [dataEnvio, setDataEnvio] = useState<Record<string, string>>({})
  const [responsavel, setResponsavel] = useState<Record<string, string>>({})
  const [searchParams, setSearchParams] = useSearchParams()
  const estado = normalizarEstadoOrdemExecucao(searchParams.get('estado'))
  const hoje = new Date().toISOString().slice(0, 10)
  const inicioPadrao = new Date(Date.now() - 89 * 86_400_000).toISOString().slice(0, 10)
  const [periodoInicio, setPeriodoInicio] = useState(inicioPadrao)
  const [periodoFim, setPeriodoFim] = useState(hoje)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const resposta = await listarOrdensExecucao()
      setItens(resposta.itens)
      setResponsaveis(resposta.responsaveis_envio)
    } catch (_) {
      toast.error('Não foi possível carregar as Ordens de Execução.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => void carregar(), [carregar])
  const itensVisiveis = useMemo(
    () => filtrarOrdensExecucao(itens, estado, periodoInicio, periodoFim),
    [estado, itens, periodoInicio, periodoFim],
  )

  const alterarEstado = (novoEstado: EstadoOrdemExecucao) => {
    const proximosParametros = new URLSearchParams(searchParams)
    if (novoEstado === 'todos') proximosParametros.delete('estado')
    else proximosParametros.set('estado', novoEstado)
    setSearchParams(proximosParametros, { replace: true })
  }

  const registrar = async (item: ItemOE) => {
    try {
      await registrarOrdemExecucao({
        negocio_id: item.negocio.id,
        oe_numero: numero[item.negocio.id],
        oe_data_envio: dataEnvio[item.negocio.id],
        oe_responsavel_envio_id: responsavel[item.negocio.id],
        updated_esperado: item.negocio.updated,
        command_idempotency_key: novaChaveOE(item.negocio.id),
        justificativa: 'Registro da referência da OE pelo Comercial',
      })
      toast.success('Ordem de Execução registrada.')
      await carregar()
    } catch (_) {
      toast.error('A Ordem de Execução não pôde ser registrada.')
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Etapa 4 · Handoff Operacional
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Ordens de Execução
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
            Conclusão do handoff dos ganhos comerciais e referência da OE no ERP após o fechamento.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void carregar()}
          disabled={loading}
          className="gap-2 border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm"
        >
          <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </section>

      <div className="grid gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label
            htmlFor="filtro-estado-oe"
            className="text-xs font-semibold uppercase tracking-wider text-slate-500"
          >
            Status
          </Label>
          <Select
            value={estado}
            onValueChange={(value) => alterarEstado(value as EstadoOrdemExecucao)}
          >
            <SelectTrigger
              id="filtro-estado-oe"
              aria-label="Status da Ordem de Execução"
              className="h-9 border-slate-200 bg-white text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="aguardando_oe">Aguardando OE</SelectItem>
              <SelectItem value="em_processo_de_entrega">Em processo de entrega</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Período inicial
          </Label>
          <Input
            type="date"
            aria-label="Período inicial"
            className="h-9 border-slate-200 bg-white text-xs"
            value={periodoInicio}
            max={periodoFim}
            onChange={(e) => setPeriodoInicio(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Período final
          </Label>
          <Input
            type="date"
            aria-label="Período final"
            className="h-9 border-slate-200 bg-white text-xs"
            value={periodoFim}
            min={periodoInicio}
            onChange={(e) => setPeriodoFim(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {itensVisiveis.map((item) => {
          const concluida = item.estado_operacional === 'em_processo_de_entrega'
          return (
            <Card
              key={item.negocio.id}
              className={`border border-slate-200/80 bg-white shadow-sm transition-all duration-150 hover:shadow-md hover:border-slate-300 ${
                concluida ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-sky-500'
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Handoff
                    </p>
                    <CardTitle className="text-base font-semibold text-slate-900">
                      {item.negocio.titulo}
                    </CardTitle>
                    {item.negocio.external_id && (
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        Negócio AC #{item.negocio.external_id}
                      </p>
                    )}
                    <CardDescription className="text-xs text-slate-500">
                      Negócio ganho
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      concluida
                        ? 'border-emerald-200/60 bg-emerald-50 text-emerald-700'
                        : 'border-sky-200/60 bg-sky-50 text-sky-700'
                    }`}
                  >
                    {concluida ? 'Em processo de entrega' : 'Aguardando OE'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <CommercialContextCard
                  contexto={item.contexto}
                  etapa="ganho"
                  negocioId={item.negocio.id}
                  showNextAction={false}
                  showReadOnlyNotice={false}
                />
                <NexoBusinessActions
                  externalId={item.negocio.external_id || item.contexto.external_id}
                  businessTitle={item.negocio.titulo}
                  allowNexoHelp={false}
                />
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs">
                  <p className="font-semibold text-slate-900">
                    Decisão registrada no CRM em{' '}
                    {formatDate(item.negocio.fechamento_data || item.contexto.crm_updated_at)}
                  </p>
                  <p className="mt-1 text-slate-500">
                    {concluida
                      ? 'OE registrada; acompanhe abaixo o envio para execução.'
                      : 'Próxima providência: registrar a referência da OE, a data e o responsável pelo envio.'}
                  </p>
                </div>
                {concluida && item.oe ? (
                  <dl className="grid gap-2 rounded-lg border border-slate-200/80 bg-slate-50/50 p-3.5 text-xs text-slate-600 sm:grid-cols-3">
                    <div>
                      <dt className="font-semibold uppercase tracking-wider text-slate-500 text-[10px]">
                        Número da OE
                      </dt>
                      <dd className="mt-1 font-bold text-slate-900 text-sm">{item.oe.numero}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold uppercase tracking-wider text-slate-500 text-[10px]">
                        Data de envio
                      </dt>
                      <dd className="mt-1 font-medium text-slate-800 text-sm">
                        {item.oe.data_envio}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold uppercase tracking-wider text-slate-500 text-[10px]">
                        Responsável pelo envio
                      </dt>
                      <dd className="mt-1 font-medium text-slate-800 text-sm">
                        {item.oe.responsavel_envio?.name || 'Não identificado'}
                      </dd>
                    </div>
                  </dl>
                ) : somenteLeitura ? (
                  <p className="rounded-lg border border-violet-200/80 bg-violet-50/70 p-3.5 text-xs font-medium text-violet-800">
                    Consulta executiva: registro de OE disponível somente para a equipe operacional.
                  </p>
                ) : (
                  <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700">Número da OE</Label>
                        <Input
                          className="border-slate-200 bg-white text-sm"
                          value={numero[item.negocio.id] || ''}
                          onChange={(event) =>
                            setNumero((atual) => ({
                              ...atual,
                              [item.negocio.id]: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700">
                          Data de envio
                        </Label>
                        <Input
                          type="date"
                          className="border-slate-200 bg-white text-sm"
                          value={dataEnvio[item.negocio.id] || ''}
                          onChange={(event) =>
                            setDataEnvio((atual) => ({
                              ...atual,
                              [item.negocio.id]: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">
                        Responsável pelo envio
                      </Label>
                      <Select
                        value={responsavel[item.negocio.id]}
                        onValueChange={(value) =>
                          setResponsavel((atual) => ({
                            ...atual,
                            [item.negocio.id]: value,
                          }))
                        }
                      >
                        <SelectTrigger className="border-slate-200 bg-white text-sm">
                          <SelectValue placeholder="Selecione o responsável" />
                        </SelectTrigger>
                        <SelectContent>
                          {responsaveis.map((usuario) => (
                            <SelectItem key={usuario.id} value={usuario.id}>
                              {usuario.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      className="w-full gap-2 bg-sky-600 hover:bg-sky-700 text-white font-medium shadow-sm"
                      disabled={
                        !numero[item.negocio.id]?.trim() ||
                        !dataEnvio[item.negocio.id] ||
                        !responsavel[item.negocio.id]
                      }
                      onClick={() => void registrar(item)}
                    >
                      <ClipboardCheck className="h-4 w-4" /> Registrar OE
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
