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

function LinhaValor({
  titulo,
  indicador,
  destaque,
}: {
  titulo: string
  indicador: IndicadorVolumeValor
  destaque?: 'emerald' | 'amber' | 'rose' | 'sky' | 'neutral'
}) {
  const borderTone =
    destaque === 'emerald'
      ? 'border-l-4 border-l-emerald-500'
      : destaque === 'amber'
        ? 'border-l-4 border-l-amber-500'
        : destaque === 'rose'
          ? 'border-l-4 border-l-rose-500'
          : destaque === 'sky'
            ? 'border-l-4 border-l-sky-500'
            : 'border-l-4 border-l-slate-400'

  const valueTone =
    destaque === 'emerald'
      ? 'text-emerald-700'
      : destaque === 'amber'
        ? 'text-amber-700'
        : destaque === 'rose'
          ? 'text-rose-700'
          : destaque === 'sky'
            ? 'text-sky-700'
            : 'text-slate-900'

  return (
    <div
      className={`rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all duration-150 hover:shadow-md hover:border-slate-300 ${borderTone}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{titulo}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight leading-none ${valueTone}`}>
        {indicador.quantidade}
      </p>
      <p className="mt-2 text-xs font-medium text-slate-600">
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
    <div className="rounded-xl border border-slate-200/80 border-l-4 border-l-emerald-500 bg-white p-4 shadow-sm transition-all duration-150 hover:shadow-md hover:border-slate-300">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{titulo}</p>
        <Badge
          variant="outline"
          className="rounded-full border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
        >
          Conversão
        </Badge>
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight leading-none text-emerald-700">
        {valor}
      </p>
      <p className="mt-2 text-xs text-slate-500">{descricao}</p>
    </div>
  )
}

function ModalidadesTable({ modalidades }: { modalidades: ModalidadeRelatorioEquipe[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <table className="w-full min-w-[780px] text-xs">
        <thead className="border-b border-slate-200 bg-slate-50/75 text-left">
          <tr>
            <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
              Modalidade
            </th>
            <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
              Total
            </th>
            <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
              Novos
            </th>
            <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
              Ganhos
            </th>
            <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
              Perdidos
            </th>
            <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
              Abertos
            </th>
            <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
              Conversão
            </th>
            <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
              Conv. valor
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {modalidades.map((modalidade) => (
            <tr key={modalidade.modalidade} className="transition-colors hover:bg-slate-50/50">
              <td className="px-4 py-3 font-semibold text-slate-900">
                {modalidade.modalidade_label}
              </td>
              <td className="px-4 py-3 text-slate-600">
                <span className="font-semibold text-slate-900">{modalidade.total.quantidade}</span>{' '}
                · {dinheiro(modalidade.total.valor_centavos)}
              </td>
              <td className="px-4 py-3 text-slate-600">
                <span className="font-semibold text-slate-900">
                  {modalidade.novos_negocios.quantidade}
                </span>{' '}
                · {dinheiro(modalidade.novos_negocios.valor_centavos)}
              </td>
              <td className="px-4 py-3 text-slate-600">
                <span className="font-semibold text-emerald-700">
                  {modalidade.ganhos.quantidade}
                </span>{' '}
                · {dinheiro(modalidade.ganhos.valor_centavos)}
              </td>
              <td className="px-4 py-3 text-slate-600">
                <span className="font-semibold text-rose-700">
                  {modalidade.perdidos.quantidade}
                </span>{' '}
                · {dinheiro(modalidade.perdidos.valor_centavos)}
              </td>
              <td className="px-4 py-3 text-slate-600">
                <span className="font-semibold text-sky-700">{modalidade.abertos.quantidade}</span>{' '}
                · {dinheiro(modalidade.abertos.valor_centavos)}
              </td>
              <td className="px-4 py-3 font-semibold text-slate-900">
                {percentual(modalidade.conversao_global_percentual)}
              </td>
              <td className="px-4 py-3 font-semibold text-slate-900">
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
    <div className="rounded-xl border border-slate-200/80 border-l-4 border-l-violet-500 bg-white p-5 shadow-sm transition-all duration-150 hover:shadow-md hover:border-slate-300">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Responsável Comercial
          </p>
          <h3 className="text-base font-bold text-slate-900">{item.operadora.nome}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {item.indicadores.total.quantidade} negócio(s) ·{' '}
            {dinheiro(item.indicadores.total.valor_centavos)}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <Badge
            variant="outline"
            className="rounded-full border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
          >
            Conversão: {percentual(item.indicadores.conversao_global_percentual)}
          </Badge>
          <Badge
            variant="outline"
            className="rounded-full border-sky-200/60 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700"
          >
            Qualitativa: {percentual(item.indicadores.conversao_qualitativa_valor_percentual)}
          </Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <LinhaValor titulo="Ganhos" indicador={item.indicadores.ganhos} destaque="emerald" />
        <LinhaValor titulo="Perdidos" indicador={item.indicadores.perdidos} destaque="rose" />
        <LinhaValor titulo="Abertos" indicador={item.indicadores.abertos} destaque="sky" />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <LinhaValor
          titulo="Novos no período"
          indicador={item.indicadores.novos_negocios}
          destaque="neutral"
        />
        <LinhaValor
          titulo="Movimento + carteira"
          indicador={item.indicadores.total}
          destaque="neutral"
        />
      </div>

      <div className="mt-5 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Detalhamento por modalidade
        </p>
        <ModalidadesTable modalidades={item.indicadores.modalidades} />
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
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Assistente Nexo · Relatórios
          </p>
          <h2 className="mt-1 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
              <BarChart3 aria-hidden="true" className="h-5 w-5" />
            </span>
            Relatório da equipe comercial
          </h2>
          <p className="mt-1.5 max-w-3xl text-sm text-slate-600">
            Visão executiva por movimento do período, carteira aberta no corte, modalidade e
            responsável. O relatório é somente leitura e respeita o perfil de acesso do usuário
            logado.
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

      <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Filtro Temporal
          </p>
          <CardTitle className="text-base font-semibold text-slate-900">
            Período do relatório
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Use para reunião de acompanhamento com Lula, Rita e Rebeca.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Início
              <input
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal text-slate-800 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                type="date"
                value={inicio}
                onChange={(event) => setInicio(event.target.value)}
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Fim
              <input
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal text-slate-800 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                type="date"
                value={fim}
                onChange={(event) => setFim(event.target.value)}
              />
            </label>
            <Button
              onClick={carregar}
              disabled={carregando}
              className="self-end bg-violet-600 font-medium text-white shadow-sm hover:bg-violet-700 h-9 px-4 text-xs"
            >
              {carregando ? (
                <Loader2 aria-hidden="true" className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              )}
              Atualizar
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Período selecionado:{' '}
            <strong className="font-semibold text-slate-700">{dataBr(inicio)}</strong> a{' '}
            <strong className="font-semibold text-slate-700">{dataBr(fim)}</strong>
          </p>
          {erro ? (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
              {erro}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {relatorio ? (
        <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Consolidação Executiva
                </p>
                <CardTitle className="text-lg font-bold text-slate-900">
                  Relatório consolidado
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Período: {dataBr(relatorio.periodo.inicio)} a {dataBr(relatorio.periodo.fim)} ·
                  Carteira aberta no corte: {dataBr(relatorio.periodo.corte_carteira_aberta)} ·
                  Escopo: {relatorio.escopo}
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="rounded-full border-slate-200/80 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
              >
                <CalendarDays aria-hidden="true" className="mr-1 h-3.5 w-3.5 text-slate-500" />{' '}
                America/Recife
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <section>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <LinhaValor
                  titulo="Movimento + carteira"
                  indicador={relatorio.resumo_geral.total}
                  destaque="neutral"
                />
                <LinhaValor
                  titulo="Novos no período"
                  indicador={relatorio.resumo_geral.novos_negocios}
                  destaque="neutral"
                />
                <LinhaValor
                  titulo="Ganhos"
                  indicador={relatorio.resumo_geral.ganhos}
                  destaque="emerald"
                />
                <LinhaValor
                  titulo="Perdidos"
                  indicador={relatorio.resumo_geral.perdidos}
                  destaque="rose"
                />
                <LinhaValor
                  titulo="Abertos"
                  indicador={relatorio.resumo_geral.abertos}
                  destaque="sky"
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Ganhos e perdidos usam a data de fechamento dentro do período. Abertos representam a
                carteira ativa na data final. Novos negócios são medidos separadamente pela data de
                criação no CRM quando disponível.
              </p>
            </section>

            <section className="grid gap-3 md:grid-cols-2">
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
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Detalhamento Geral
              </p>
              <h2 className="text-base font-bold text-slate-900">Volume por modalidade</h2>
              <ModalidadesTable modalidades={relatorio.resumo_geral.modalidades} />
            </section>

            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Performance Individual
              </p>
              <h2 className="text-base font-bold text-slate-900">Responsáveis comerciais</h2>
              <div className="space-y-4">
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
        <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <CardContent className="flex items-center gap-2.5 p-6 text-xs text-slate-600">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-violet-600" />{' '}
            Carregando relatório...
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
