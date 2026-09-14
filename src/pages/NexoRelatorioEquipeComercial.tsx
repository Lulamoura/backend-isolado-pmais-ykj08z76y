import { useEffect, useState } from 'react'
import { BarChart3, CalendarDays, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  obterRelatorioEquipeComercial,
  type IndicadorVolumeValor,
  type ModalidadeRelatorioEquipe,
  type OperadoraRelatorioEquipe,
  type RelatorioEquipeComercialResponse,
} from '@/services/nexo-relatorio-equipe'

function hojeRecife() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function primeiroDiaMes(data: string) {
  return `${data.slice(0, 8)}01`
}

function dinheiro(centavos: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (centavos || 0) / 100,
  )
}

function percentual(valor: number | null | undefined) {
  return valor === null || valor === undefined ? '—' : `${String(valor).replace('.', ',')}%`
}

function dataBr(data: string | null | undefined) {
  if (!data) return 'em aberto'
  const partes = data.slice(0, 10).split('-')
  if (partes.length !== 3) return data
  return `${partes[2]}/${partes[1]}/${partes[0]}`
}

function LinhaValor({ titulo, indicador }: { titulo: string; indicador: IndicadorVolumeValor }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950 p-4 text-white shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className="mt-2 text-3xl font-black leading-none">{indicador.quantidade}</p>
      <p className="mt-2 text-sm font-medium text-slate-200">
        {dinheiro(indicador.valor_centavos)}
      </p>
    </div>
  )
}

function CardConversao({
  titulo,
  valor,
  descricao,
}: {
  titulo: string
  valor: string
  descricao: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-2 text-3xl font-black leading-none text-slate-950">{valor}</p>
      <p className="mt-2 text-xs text-slate-500">{descricao}</p>
    </div>
  )
}

function ModalidadesTable({
  modalidades,
  compacto = false,
}: {
  modalidades: ModalidadeRelatorioEquipe[]
  compacto?: boolean
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className={`w-full text-sm ${compacto ? 'min-w-[680px]' : 'min-w-[780px]'}`}>
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3">Modalidade</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Ganhos</th>
            <th className="px-4 py-3">Perdidos</th>
            <th className="px-4 py-3">Abertos</th>
            <th className="px-4 py-3">Conversão</th>
            <th className="px-4 py-3">Conv. valor</th>
          </tr>
        </thead>
        <tbody>
          {modalidades.map((modalidade) => (
            <tr key={modalidade.modalidade} className="border-t border-slate-200">
              <td className="px-4 py-3 font-semibold text-slate-950">
                {modalidade.modalidade_label}
              </td>
              <td className="px-4 py-3">
                {modalidade.total.quantidade} · {dinheiro(modalidade.total.valor_centavos)}
              </td>
              <td className="px-4 py-3">
                {modalidade.ganhos.quantidade} · {dinheiro(modalidade.ganhos.valor_centavos)}
              </td>
              <td className="px-4 py-3">
                {modalidade.perdidos.quantidade} · {dinheiro(modalidade.perdidos.valor_centavos)}
              </td>
              <td className="px-4 py-3">
                {modalidade.abertos.quantidade} · {dinheiro(modalidade.abertos.valor_centavos)}
              </td>
              <td className="px-4 py-3">{percentual(modalidade.conversao_global_percentual)}</td>
              <td className="px-4 py-3">
                {percentual(modalidade.conversao_qualitativa_valor_percentual)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OperadoraCard({ item }: { item: OperadoraRelatorioEquipe }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-950">{item.operadora.nome}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {item.indicadores.total.quantidade} negócio(s) ·{' '}
            {dinheiro(item.indicadores.total.valor_centavos)}
          </p>
        </div>
        <Badge variant="outline">
          Conversão {percentual(item.indicadores.conversao_global_percentual)}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <LinhaValor titulo="Ganhos" indicador={item.indicadores.ganhos} />
        <LinhaValor titulo="Perdidos" indicador={item.indicadores.perdidos} />
        <LinhaValor titulo="Abertos" indicador={item.indicadores.abertos} />
      </div>

      <div className="mt-5 space-y-2">
        <p className="text-sm font-semibold text-slate-800">Detalhamento por modalidade</p>
        <ModalidadesTable modalidades={item.indicadores.modalidades} compacto />
      </div>
    </div>
  )
}

export default function NexoRelatorioEquipeComercial() {
  const hoje = hojeRecife()
  const [inicio, setInicio] = useState(primeiroDiaMes(hoje))
  const [fim, setFim] = useState(hoje)
  const [relatorio, setRelatorio] = useState<RelatorioEquipeComercialResponse | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  async function carregar() {
    setCarregando(true)
    setErro('')
    try {
      const resposta = await obterRelatorioEquipeComercial({ inicio, fim, incluir_html: false })
      setRelatorio(resposta)
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar o relatório da equipe comercial.',
      )
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [])

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
      <section className="rounded-2xl bg-gradient-to-r from-slate-950 via-violet-950 to-indigo-950 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-violet-200">
              Assistente Nexo
            </p>
            <h1 className="mt-1 flex items-center gap-3 text-3xl font-extrabold tracking-tight">
              <BarChart3 aria-hidden="true" className="h-8 w-8 text-violet-200" /> Relatório da
              equipe comercial
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-violet-100/90">
              Visão executiva condensada por período, modalidade e responsável. O relatório é
              somente leitura e respeita o perfil de acesso do usuário logado.
            </p>
          </div>
          <Badge className="border-violet-300/50 bg-white/10 text-violet-50 hover:bg-white/10">
            <ShieldCheck aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> Somente leitura
          </Badge>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Período do relatório</CardTitle>
          <CardDescription>
            Use para reunião de acompanhamento com Lula, Rita e Rebeca.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="text-sm font-medium text-slate-700">
              Início
              <input
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                type="date"
                value={inicio}
                onChange={(event) => setInicio(event.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Fim
              <input
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                type="date"
                value={fim}
                onChange={(event) => setFim(event.target.value)}
              />
            </label>
            <Button onClick={carregar} disabled={carregando} className="self-end">
              {carregando ? (
                <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
              )}
              Atualizar
            </Button>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Período selecionado: <strong>{dataBr(inicio)}</strong> a <strong>{dataBr(fim)}</strong>
          </p>
          {erro ? <p className="mt-3 text-sm text-red-600">{erro}</p> : null}
        </CardContent>
      </Card>

      {relatorio ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Relatório consolidado</CardTitle>
                <CardDescription>
                  Período: {dataBr(relatorio.periodo.inicio)} a {dataBr(relatorio.periodo.fim)} ·
                  Escopo: {relatorio.escopo}
                </CardDescription>
              </div>
              <Badge variant="outline">
                <CalendarDays aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> America/Recife
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <div className="grid gap-4 md:grid-cols-4">
                <LinhaValor titulo="Volume total" indicador={relatorio.resumo_geral.total} />
                <LinhaValor titulo="Ganhos" indicador={relatorio.resumo_geral.ganhos} />
                <LinhaValor titulo="Perdidos" indicador={relatorio.resumo_geral.perdidos} />
                <LinhaValor titulo="Abertos" indicador={relatorio.resumo_geral.abertos} />
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <CardConversao
                titulo="Conversão global"
                valor={percentual(relatorio.resumo_geral.conversao_global_percentual)}
                descricao="ganhos / ganhos + perdidos"
              />
              <CardConversao
                titulo="Conversão por valor"
                valor={percentual(relatorio.resumo_geral.conversao_qualitativa_valor_percentual)}
                descricao="valor ganho / valor ganho + valor perdido"
              />
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-950">Volume por modalidade</h2>
              <ModalidadesTable modalidades={relatorio.resumo_geral.modalidades} />
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-950">Responsáveis comerciais</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {relatorio.operadoras.map((operadora) => (
                  <OperadoraCard
                    key={operadora.operadora.id || operadora.operadora.nome}
                    item={operadora}
                  />
                ))}
              </div>
            </section>
          </CardContent>
        </Card>
      ) : carregando ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-slate-600">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Carregando relatório...
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
