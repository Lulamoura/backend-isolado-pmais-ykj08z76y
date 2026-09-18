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
  obterStatusIpcpJobDiarioHomologacao,
  type IpcpDiarioReadOnly,
  type IpcpJobDiarioHomologacaoStatus,
} from '@/services/ipcp'

function dataBr(data: string) {
  const partes = data.split('-')
  if (partes.length !== 3) return data
  return `${partes[2]}/${partes[1]}/${partes[0]}`
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
    <Card>
      <CardHeader>
        <CardTitle>Evidências resumidas</CardTitle>
        <CardDescription>
          Amostra de sinais comerciais em linguagem gerencial, sem detalhes internos.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {data.evidencias.exemplos.map((item) => (
          <div key={`${item.bloco}-${item.sinal}`} className="rounded-xl border bg-white p-4">
            <p className="text-sm font-semibold text-slate-950">
              {rotulosBlocos[item.bloco] ?? item.bloco}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Sinal: {item.sinal}</p>
            <p className="mt-1 text-sm leading-6 text-slate-700">Ação: {item.acao}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function JobDiarioStatus({ status }: { status: IpcpJobDiarioHomologacaoStatus | null }) {
  if (!status) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rotina diária em produção assistida</CardTitle>
        <CardDescription>
          Execução diária supervisionada, sem alteração automática de negócios ou CRM.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-4">
        <Badge className="justify-center bg-emerald-700 py-2 text-white hover:bg-emerald-700">
          Ativa em produção assistida
        </Badge>
        <Badge variant="outline" className="justify-center py-2">
          Horário: {status.job.horario_recife}
        </Badge>
        <Badge variant="outline" className="justify-center py-2">
          Produção assistida
        </Badge>
        <Badge variant="outline" className="justify-center py-2">
          CRM: sem alteração
        </Badge>
      </CardContent>
    </Card>
  )
}

export default function IpcpSimulacaoGerencial() {
  const [data, setData] = useState<IpcpDiarioReadOnly | null>(null)
  const [jobStatus, setJobStatus] = useState<IpcpJobDiarioHomologacaoStatus | null>(null)
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
      const [leitura, statusJob] = await Promise.all([
        obterNexoIpcpDiarioEquipe(escopoSolicitado, responsavelId),
        obterStatusIpcpJobDiarioHomologacao(),
      ])
      setData(leitura)
      setJobStatus(statusJob)
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
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
      <section className="rounded-2xl bg-gradient-to-r from-slate-950 via-emerald-950 to-violet-950 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-200">
              IPCP — produção assistida
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
              Índice de Performance Comercial PMais
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-100/90">
              Leitura viva gerencial por responsável ou visão consolidada de todos. A tela mostra
              uma leitura por vez para preservar clareza e governança.
            </p>
          </div>
          <Badge className="border-emerald-300/50 bg-white/10 text-emerald-50 hover:bg-white/10">
            <ShieldCheck aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> Somente leitura
          </Badge>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline">
          <Link to="/nexo">
            <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" /> Voltar ao Nexo
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void recalcularIpcp()} disabled={loading || recalculando} variant="default">
            {recalculando ? (
              <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
            )}
            Recalcular IPCP
          </Button>
        <Button onClick={() => void carregar()} disabled={loading || recalculando} variant="outline">
          {loading ? (
            <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
          )}
          Atualizar leitura
        </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtro de responsáveis</CardTitle>
          <CardDescription>
            Selecione uma operadora para ver a leitura individual ou use “Todos” para a visão
            global consolidada dos gestores.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[220px_1fr]">
          <Button
            type="button"
            variant={responsavelId ? 'outline' : 'default'}
            onClick={() => {
              setResponsavelId(null)
              setResponsavelSelecionado(null)
            }}
            disabled={loading}
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
        <Alert variant="destructive">
          <AlertTitle>IPCP indisponível</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      ) : null}

      {loading && !data ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-sm text-slate-600">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Carregando leitura do
            IPCP.
          </CardContent>
        </Card>
      ) : null}

      {data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Escopo da leitura</CardTitle>
              <CardDescription>
                Base {dataBr(data.data_referencia)} ·{' '}
                {responsavelId
                  ? `Responsável: ${responsavelSelecionado?.name ?? data.escopo?.responsavel_nome ?? 'selecionado'}`
                  : 'Todos — visão global consolidada'}
              </CardDescription>
            </CardHeader>
          </Card>
          <JobDiarioStatus status={jobStatus} />
          <IpcpEducativoDiarioCard data={data} />
          <EvidenciasResumo data={data} />
        </>
      ) : null}
    </div>
  )
}
