import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'

import { IpcpEducativoDiarioCard } from '@/components/ipcp/IpcpEducativoDiarioCard'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  criarIpcpSnapshotSimulado,
  obterIpcpSimulacaoReadOnly,
  type IpcpDiarioReadOnly,
  type IpcpSnapshotSimuladoResponse,
} from '@/services/ipcp'

function dataBr(data: string) {
  const partes = data.split('-')
  if (partes.length !== 3) return data
  return `${partes[2]}/${partes[1]}/${partes[0]}`
}

function SimulacaoGuardrails({ data }: { data: IpcpDiarioReadOnly }) {
  const simulacao = data.simulacao
  return (
    <Card>
      <CardHeader>
        <CardTitle>Guardrails da simulação</CardTitle>
        <CardDescription>
          Leitura piloto para gestão, sem persistência e sem job automático.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-4">
        <Badge className="justify-center bg-emerald-700 py-2 text-white hover:bg-emerald-700">
          Read-only confirmado
        </Badge>
        <Badge variant="outline" className="justify-center py-2">
          Snapshot: {simulacao?.gravacao_snapshot_realizada ? 'gravado' : 'não gravado'}
        </Badge>
        <Badge variant="outline" className="justify-center py-2">
          Coleção: {simulacao?.colecao_snapshot_criada ? 'criada' : 'não criada'}
        </Badge>
        <Badge variant="outline" className="justify-center py-2">
          Job: {simulacao?.job_automatico_ativo ? 'ativo' : 'inativo'}
        </Badge>
      </CardContent>
    </Card>
  )
}

function EvidenciasResumo({ data }: { data: IpcpDiarioReadOnly }) {
  if (!data.evidencias?.exemplos?.length) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidências resumidas</CardTitle>
        <CardDescription>
          Amostra de sinais comerciais, sem payload técnico sensível.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {data.evidencias.exemplos.map((item) => (
          <div key={`${item.bloco}-${item.sinal}`} className="rounded-xl border bg-white p-4">
            <p className="text-sm font-semibold text-slate-950">{item.bloco}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Sinal: {item.sinal}</p>
            <p className="mt-1 text-sm leading-6 text-slate-700">Ação: {item.acao}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function IpcpSimulacaoGerencial() {
  const [data, setData] = useState<IpcpDiarioReadOnly | null>(null)
  const [snapshot, setSnapshot] = useState<IpcpSnapshotSimuladoResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  async function carregar() {
    setLoading(true)
    setErro('')
    try {
      setData(await obterIpcpSimulacaoReadOnly())
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar a simulação read-only do IPCP.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function gravarSnapshotSimulado() {
    setSaving(true)
    setErro('')
    try {
      setSnapshot(await criarIpcpSnapshotSimulado())
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível gravar o snapshot simulado do IPCP.',
      )
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [])

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
      <section className="rounded-2xl bg-gradient-to-r from-slate-950 via-emerald-950 to-violet-950 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-200">
              IPCP — piloto gerencial
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
              Simulação do Índice de Performance Comercial PMais
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-100/90">
              Leitura da simulação read-only para homologar fórmula, escopo e apresentação antes de
              qualquer snapshot persistido ou rotina automática.
            </p>
          </div>
          <Badge className="border-emerald-300/50 bg-white/10 text-emerald-50 hover:bg-white/10">
            <ShieldCheck aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> Sem gravação
          </Badge>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline">
          <Link to="/nexo">
            <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" /> Voltar ao Nexo
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void carregar()} disabled={loading || saving} variant="outline">
            {loading ? (
              <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
            )}
            Atualizar simulação
          </Button>
          <Button onClick={() => void gravarSnapshotSimulado()} disabled={!data || loading || saving}>
            {saving ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> : null}
            Gravar snapshot simulado
          </Button>
        </div>
      </div>

      {erro ? (
        <Alert variant="destructive">
          <AlertTitle>Simulação indisponível</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      ) : null}

      {snapshot ? (
        <Alert>
          <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          <AlertTitle>Snapshot simulado gravado para homologação</AlertTitle>
          <AlertDescription>
            Registro {snapshot.snapshot.id} · {snapshot.snapshot.data_referencia} ·{' '}
            {snapshot.snapshot.escopo}. Job automático permanece inativo.
          </AlertDescription>
        </Alert>
      ) : null}

      {loading && !data ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-sm text-slate-600">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Carregando simulação
            read-only do IPCP.
          </CardContent>
        </Card>
      ) : null}

      {data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Escopo da leitura</CardTitle>
              <CardDescription>
                Base {dataBr(data.data_referencia)} · {data.escopo?.tipo ?? 'escopo resolvido'} ·{' '}
                {data.escopo?.responsavel_nome ?? 'usuário autenticado'}
              </CardDescription>
            </CardHeader>
          </Card>
          <SimulacaoGuardrails data={data} />
          <IpcpEducativoDiarioCard data={data} />
          <EvidenciasResumo data={data} />
        </>
      ) : null}
    </div>
  )
}
