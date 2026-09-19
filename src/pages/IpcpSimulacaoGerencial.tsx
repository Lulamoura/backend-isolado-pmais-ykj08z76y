import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'

import { IpcpEducativoDiarioCard } from '@/components/ipcp/IpcpEducativoDiarioCard'
import { UserSelect, type UserOption } from '@/components/UserSelect'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  executarIpcpProcessamentoDiarioHomologacao,
  obterNexoIpcpDiarioEquipe,
  type IpcpDiarioReadOnly,
} from '@/services/ipcp'

function dataBr(data: string) {
  const partes = data.split('-')
  if (partes.length !== 3) return data
  return `${partes[2]}/${partes[1]}/${partes[0]}`
}

function baseIpcp(value?: string | null) {
  if (!value) return 'data/hora não informada'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${dataBr(value)} - HH:MM não informado`
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Recife',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(parsed)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.day}/${values.month}/${values.year} - ${values.hour}:${values.minute}`
}

const rotulosBlocos: Record<string, string> = {
  qualidade_followup: 'Qualidade do acompanhamento',
  disciplina_carteira: 'Organização da carteira',
  registros_aprendizado: 'Registros e aprendizados',
  resultado_comercial: 'Resultado comercial',
  valor_estrategico: 'Valor estratégico',
}

function EvidenciasResumo({ data }: { data: IpcpDiarioReadOnly }) {
  if (!data.evidencias?.exemplos?.length) return null
  return (
    <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Sinais e Governança
        </p>
        <CardTitle className="text-base font-semibold text-slate-900">
          Evidências resumidas
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Amostra de sinais comerciais em linguagem gerencial, sem detalhes internos.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {data.evidencias.exemplos.map((item) => (
          <div
            key={`${item.bloco}-${item.sinal}`}
            className="rounded-xl border border-slate-200/80 border-l-4 border-l-violet-500 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
              {rotulosBlocos[item.bloco] ?? item.bloco}
            </p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              <strong className="text-slate-800">Sinal:</strong> {item.sinal}
            </p>
            <p className="mt-1.5 rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-xs font-medium text-slate-800 leading-relaxed">
              <span className="text-slate-500 font-semibold block text-[10px] uppercase tracking-wider">
                Ação sugerida
              </span>
              {item.acao}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function IpcpSimulacaoGerencial() {
  const [data, setData] = useState<IpcpDiarioReadOnly | null>(null)
  const [loading, setLoading] = useState(false)
  const [recalculando, setRecalculando] = useState(false)
  const [erro, setErro] = useState('')
  const [responsavelId, setResponsavelId] = useState<string | null>(null)
  const [responsavelSelecionado, setResponsavelSelecionado] = useState<UserOption | null>(null)

  const escopoSolicitado = responsavelId ? 'equipe' : 'todos'

  async function carregar() {
    setLoading(true)
    setErro('')
    try {
      const leitura = await obterNexoIpcpDiarioEquipe(escopoSolicitado, responsavelId)
      setData(leitura)
    } catch (error) {
      setErro(
        error instanceof Error ? error.message : 'Não foi possível carregar a leitura do IPCP.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function recalcularIpcp() {
    setRecalculando(true)
    setErro('')
    try {
      await executarIpcpProcessamentoDiarioHomologacao()
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível recalcular o IPCP.')
    } finally {
      setRecalculando(false)
    }
  }

  useEffect(() => {
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responsavelId])

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            IPCP — Índice de Performance Comercial PMais
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Análise gerencial do IPCP
          </h2>
          <p className="mt-1.5 max-w-3xl text-sm text-slate-600">
            Leitura viva gerencial por responsável ou visão consolidada de todos. A tela mostra uma
            leitura por vez para preservar clareza e governança.
          </p>
        </div>
        <Badge
          variant="outline"
          className="rounded-full border-slate-200/80 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700"
        >
          <ShieldCheck aria-hidden="true" className="mr-1 h-3.5 w-3.5 text-slate-500" /> Somente
          leitura
        </Badge>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          asChild
          variant="outline"
          className="gap-2 border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 text-xs h-9"
        >
          <Link to="/nexo">
            <ArrowLeft aria-hidden="true" className="h-4 w-4 text-slate-500" /> Voltar ao Nexo
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => void recalcularIpcp()}
            disabled={loading || recalculando}
            className="gap-2 bg-emerald-600 font-medium text-white shadow-sm hover:bg-emerald-700 text-xs h-9"
          >
            {recalculando ? (
              <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            Recalcular IPCP
          </Button>
          <Button
            onClick={() => void carregar()}
            disabled={loading || recalculando}
            variant="outline"
            className="gap-2 border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 text-xs h-9"
          >
            {loading ? (
              <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw aria-hidden="true" className="h-3.5 w-3.5 text-slate-500" />
            )}
            Atualizar leitura
          </Button>
        </div>
      </div>

      <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Filtro de Escopo
          </p>
          <CardTitle className="text-base font-semibold text-slate-900">
            Filtro de responsáveis
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Selecione uma operadora para ver a leitura individual ou use “Todos” para a visão global
            consolidada dos gestores.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[160px_1fr]">
          <Button
            type="button"
            variant={responsavelId ? 'outline' : 'default'}
            onClick={() => {
              setResponsavelId(null)
              setResponsavelSelecionado(null)
            }}
            disabled={loading}
            className={`h-9 text-xs font-medium ${
              !responsavelId
                ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Todos
          </Button>
          <UserSelect
            value={responsavelId}
            onChange={setResponsavelId}
            onSelect={setResponsavelSelecionado}
            placeholder="Selecionar responsável"
            ariaLabel="Selecionar responsável para IPCP"
            disabled={loading}
          />
        </CardContent>
      </Card>

      {erro ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTitle>IPCP indisponível</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      ) : null}

      {loading && !data ? (
        <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <CardContent className="flex items-center gap-2.5 p-6 text-xs text-slate-600">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-emerald-600" />{' '}
            Carregando leitura do IPCP...
          </CardContent>
        </Card>
      ) : null}

      {data ? (
        <>
          <Card className="rounded-xl border border-slate-200/80 border-l-4 border-l-emerald-500 bg-white shadow-sm">
            <CardHeader className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Contexto Operacional
                  </p>
                  <CardTitle className="text-base font-bold text-slate-900">
                    Escopo da leitura
                  </CardTitle>
                </div>
                <Badge
                  variant="outline"
                  className="rounded-full border-emerald-200/60 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700"
                >
                  {responsavelId
                    ? `Responsável: ${responsavelSelecionado?.name ?? data.escopo?.responsavel_nome ?? 'selecionado'}`
                    : 'Visão global consolidada'}
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Base {baseIpcp(data.atualizado_em)} ·{' '}
                {responsavelId
                  ? `Responsável: ${responsavelSelecionado?.name ?? data.escopo?.responsavel_nome ?? 'selecionado'}`
                  : 'Todos — visão global consolidada'}
              </CardDescription>
            </CardHeader>
          </Card>
          <IpcpEducativoDiarioCard data={data} />
          <EvidenciasResumo data={data} />
        </>
      ) : null}
    </div>
  )
}
