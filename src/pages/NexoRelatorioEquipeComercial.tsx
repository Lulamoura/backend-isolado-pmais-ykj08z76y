import { useEffect, useState } from 'react'
import { BarChart3, CalendarDays, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  obterRelatorioEquipeComercial,
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

function Kpi({
  titulo,
  valor,
  subtitulo,
}: {
  titulo: string
  valor: string | number
  subtitulo?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{titulo}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{valor}</p>
      {subtitulo ? <p className="mt-1 text-xs text-slate-500">{subtitulo}</p> : null}
    </div>
  )
}

function OperadoraCard({ item }: { item: OperadoraRelatorioEquipe }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{item.operadora.nome}</CardTitle>
        <CardDescription>
          {item.indicadores.total.quantidade} negócio(s) ·{' '}
          {dinheiro(item.indicadores.total.valor_centavos)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Kpi
            titulo="Ganhos"
            valor={item.indicadores.ganhos.quantidade}
            subtitulo={dinheiro(item.indicadores.ganhos.valor_centavos)}
          />
          <Kpi
            titulo="Perdidos"
            valor={item.indicadores.perdidos.quantidade}
            subtitulo={dinheiro(item.indicadores.perdidos.valor_centavos)}
          />
          <Kpi
            titulo="Abertos"
            valor={item.indicadores.abertos.quantidade}
            subtitulo={dinheiro(item.indicadores.abertos.valor_centavos)}
          />
          <Kpi
            titulo="Conversão"
            valor={percentual(item.indicadores.conversao_global_percentual)}
            subtitulo="ganhos / ganhos + perdidos"
          />
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Modalidade</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Ganhos</th>
                <th className="px-4 py-3">Perdidos</th>
                <th className="px-4 py-3">Conversão</th>
                <th className="px-4 py-3">Conv. valor</th>
              </tr>
            </thead>
            <tbody>
              {item.indicadores.modalidades.map((modalidade) => (
                <tr key={modalidade.modalidade} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-950">
                    {modalidade.modalidade_label}
                  </td>
                  <td className="px-4 py-3">{modalidade.total.quantidade}</td>
                  <td className="px-4 py-3">{dinheiro(modalidade.total.valor_centavos)}</td>
                  <td className="px-4 py-3">{modalidade.ganhos.quantidade}</td>
                  <td className="px-4 py-3">{modalidade.perdidos.quantidade}</td>
                  <td className="px-4 py-3">
                    {percentual(modalidade.conversao_global_percentual)}
                  </td>
                  <td className="px-4 py-3">
                    {percentual(modalidade.conversao_qualitativa_valor_percentual)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
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
      const resposta = await obterRelatorioEquipeComercial({ inicio, fim, incluir_html: true })
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
              Visão executiva por operadora e modalidade. O relatório é somente leitura e respeita o
              perfil de acesso do usuário logado.
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
          {erro ? <p className="mt-3 text-sm text-red-600">{erro}</p> : null}
        </CardContent>
      </Card>

      {relatorio ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Kpi
              titulo="Negócios"
              valor={relatorio.resumo_geral.total.quantidade}
              subtitulo="volume no período"
            />
            <Kpi
              titulo="Valor total"
              valor={dinheiro(relatorio.resumo_geral.total.valor_centavos)}
            />
            <Kpi
              titulo="Conversão global"
              valor={percentual(relatorio.resumo_geral.conversao_global_percentual)}
            />
            <Kpi
              titulo="Conversão por valor"
              valor={percentual(relatorio.resumo_geral.conversao_qualitativa_valor_percentual)}
            />
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Resumo executivo em HTML</CardTitle>
                  <CardDescription>
                    Período: {relatorio.periodo.inicio || 'início aberto'} a{' '}
                    {relatorio.periodo.fim || 'fim aberto'} · Escopo: {relatorio.escopo}
                  </CardDescription>
                </div>
                <Badge variant="outline">
                  <CalendarDays aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> America/Recife
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {relatorio.html_executivo ? (
                <iframe
                  title="Relatório executivo da equipe comercial"
                  srcDoc={relatorio.html_executivo}
                  className="h-[720px] w-full rounded-xl border border-slate-200 bg-white"
                />
              ) : (
                <p className="text-sm text-slate-600">HTML executivo não retornado.</p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {relatorio.operadoras.map((operadora) => (
              <OperadoraCard
                key={operadora.operadora.id || operadora.operadora.nome}
                item={operadora}
              />
            ))}
          </div>
        </>
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
