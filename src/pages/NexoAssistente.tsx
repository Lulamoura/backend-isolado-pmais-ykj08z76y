import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  BookOpenCheck,
  Bot,
  CalendarClock,
  FileClock,
  Lightbulb,
  ListChecks,
  Loader2,
  NotebookPen,
  Sparkles,
  ThermometerSun,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ActiveCampaignDealLink } from '@/components/ActiveCampaignDealLink'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'
import {
  gerarAnaliseCentralNexo,
  listarResponsaveisCentralNexo,
  type AnaliseCentralNexoResponse,
  type FrenteCentralNexo,
  type ResponsavelComercialOpcao,
} from '@/services/nexo-central'

const frentesNexo: Array<{
  id: FrenteCentralNexo
  titulo: string
  subtitulo: string
  icon: typeof Sparkles
  leitura: string
  perguntas: string[]
  saida: string[]
}> = [
  {
    id: 'recomendacoes-dia',
    titulo: 'Recomendações do dia',
    subtitulo: 'Prioridades comerciais para orientar a rotina do time.',
    icon: Sparkles,
    leitura:
      'Consolida o que merece atenção hoje: negócios com próxima ação relevante, propostas paradas, oportunidades quentes e lacunas de informação.',
    perguntas: [
      'Quais negócios devem receber contato hoje?',
      'Onde há chance de avanço com baixo esforço?',
      'Qual ação precisa ser tomada antes do fim do dia?',
    ],
    saida: [
      'lista priorizada de ações do dia;',
      'justificativa comercial breve;',
      'atalhos para abrir o negócio, proposta ou follow-up.',
    ],
  },
  {
    id: 'risco-esfriamento',
    titulo: 'Negócios com risco de esfriamento',
    subtitulo: 'Sinais de silêncio, prazo longo ou perda de temperatura comercial.',
    icon: ThermometerSun,
    leitura:
      'Aponta negócios ainda abertos que podem perder tração por falta de contato, decisão sem prazo, objeção não tratada ou próxima ação distante.',
    perguntas: [
      'A próxima ação está distante demais do prazo citado pelo cliente?',
      'O decisor ou responsável pela análise está claro?',
      'Há nota recente que explique o silêncio?',
    ],
    saida: [
      'risco principal por negócio;',
      'ação recomendada para reaquecer a conversa;',
      'alertas de lacunas: decisor, prazo, objeção ou pendência PMais.',
    ],
  },
  {
    id: 'propostas-sem-retorno',
    titulo: 'Propostas sem retorno',
    subtitulo: 'Propostas enviadas, abertas ou não, ainda sem resposta objetiva.',
    icon: FileClock,
    leitura:
      'Separa proposta recém-enviada, proposta sem abertura e proposta aberta sem resposta, para orientar follow-up adequado sem cobrança genérica.',
    perguntas: [
      'A proposta foi aberta?',
      'Quantos dias úteis se passaram desde o envio?',
      'O último follow-up pediu decisão, dúvida ou apenas conferiu recebimento?',
    ],
    saida: [
      'fila de propostas por urgência;',
      'tipo de follow-up recomendado;',
      'sugestão de mensagem curta quando aplicável.',
    ],
  },
  {
    id: 'notas-incompletas',
    titulo: 'Notas ruins/incompletas',
    subtitulo: 'Registros que impedem o Nexo de ajudar com precisão.',
    icon: NotebookPen,
    leitura:
      'Identifica notas vagas, sem prazo, sem decisor, sem objeção registrada ou sem próximo compromisso verificável.',
    perguntas: [
      'A nota informa quem falou e qual cargo/área?',
      'Existe prazo prometido pelo cliente?',
      'A objeção, dúvida ou pendência ficou explícita?',
    ],
    saida: [
      'notas que precisam de complementação;',
      'campos/fatos faltantes;',
      'exemplo de nota melhor para o operador registrar.',
    ],
  },
  {
    id: 'followups-atrasados',
    titulo: 'Follow-ups atrasados ou mal definidos',
    subtitulo: 'Ações vencidas, ausentes ou sem dono claro.',
    icon: CalendarClock,
    leitura:
      'Mostra follow-ups vencidos, sem data, sem responsável, ou incompatíveis com o ritmo real informado pelo cliente.',
    perguntas: [
      'Existe próxima ação cadastrada?',
      'A data faz sentido diante do prazo do cliente?',
      'O follow-up tem objetivo claro: tirar dúvida, cobrar retorno, confirmar decisor ou remarcar conversa?',
    ],
    saida: [
      'follow-ups a corrigir;',
      'prioridade por risco comercial;',
      'próxima ação sugerida para cada caso.',
    ],
  },
  {
    id: 'aprendizados-comerciais',
    titulo: 'Aprendizados comerciais',
    subtitulo: 'Padrões úteis para melhorar abordagem, proposta e fechamento.',
    icon: BookOpenCheck,
    leitura:
      'Resume sinais recorrentes: objeções, serviços mais demandados, motivos de perda, boas práticas de follow-up e melhorias de anotação.',
    perguntas: [
      'Que objeções se repetiram?',
      'Que tipos de serviço avançaram melhor?',
      'Que práticas de notas/follow-up ajudaram negócios?',
    ],
    saida: [
      'síntese executiva para Lula/gestão;',
      'orientações práticas para o time;',
      'temas que devem virar playbook do Nexo.',
    ],
  },
]

const perfisVisaoGeral = new Set([
  'superadministrador',
  'leitura-executiva',
  'gestor',
  'gestor-comercial',
])

function Lista({ titulo, itens }: { titulo: string; itens: readonly string[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{titulo}</p>
      <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600">
        {itens.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function providerLabel(resultado: AnaliseCentralNexoResponse) {
  return (
    resultado.agent_display ||
    (resultado.provider === 'nexo_hermes'
      ? 'Agente Nexo'
      : resultado.provider || 'Agente não informado')
  )
}

function modeloLabel(resultado: AnaliseCentralNexoResponse) {
  return (
    resultado.model_display || resultado.modelo || resultado.nexo_provider || 'modelo não informado'
  )
}

function ResultadoNexo({ resultado }: { resultado: AnaliseCentralNexoResponse }) {
  const blocos = resultado.analise
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)

  return (
    <Card className="rounded-xl border border-emerald-200/80 border-l-4 border-l-emerald-500 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
              Análise Concluída
            </p>
            <CardTitle className="text-base font-bold text-slate-900">
              Resultado da análise do Nexo
            </CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                resultado.fallback
                  ? 'border-amber-200/60 bg-amber-50 text-amber-700'
                  : 'border-emerald-200/60 bg-emerald-50 text-emerald-700'
              }`}
            >
              {resultado.fallback ? 'Fallback contextual' : 'IA real'}
            </Badge>
            <Badge
              variant="outline"
              className="rounded-full border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600"
            >
              Provider: {providerLabel(resultado)}
            </Badge>
            <Badge
              variant="outline"
              className="rounded-full border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600"
            >
              Modelo: {modeloLabel(resultado)}
            </Badge>
          </div>
        </div>
        <CardDescription className="text-xs text-slate-500">
          {resultado.escopo.label} · {resultado.total_negocios} negócio(s) considerados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm leading-relaxed text-slate-800">
          {blocos.length ? (
            blocos.map((bloco) => <p key={bloco}>{bloco}</p>)
          ) : (
            <p>Sem análise textual retornada.</p>
          )}
        </div>
        {resultado.itens.length ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Negócios citados ({resultado.itens.length})
            </p>
            <div className="grid gap-3">
              {resultado.itens.slice(0, 6).map((item, index) => {
                const idNegocio =
                  item.id_negocio || item.external_id || item.negocio_id || 'Sem ID externo'
                return (
                  <div
                    key={`${item.negocio_id || item.external_id || index}`}
                    className="rounded-xl border border-slate-200/80 border-l-4 border-l-violet-500 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900">
                        {item.titulo || 'Negócio sem título'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          ID do negócio: {idNegocio}
                        </span>
                        <ActiveCampaignDealLink dealId={idNegocio} compact />
                      </div>
                    </div>
                    <div className="mt-2.5 grid gap-1.5 text-xs text-slate-600 sm:grid-cols-3">
                      <div>
                        <span className="font-semibold text-slate-500">Cliente: </span>
                        <span className="font-medium text-slate-800">
                          {item.cliente || 'não informado'}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">Contato: </span>
                        <span className="font-medium text-slate-800">
                          {item.contato || 'não informado'}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">Responsável interno: </span>
                        <span className="font-medium text-slate-800">
                          {item.responsavel || 'não informado'}
                        </span>
                      </div>
                    </div>
                    {item.detalhamento_proposta ? (
                      <p className="mt-2.5 rounded-lg border border-slate-200/70 bg-slate-50/70 p-2.5 text-xs leading-relaxed text-slate-700">
                        <strong className="text-slate-800">Detalhamento da proposta:</strong>{' '}
                        {item.detalhamento_proposta}
                      </p>
                    ) : null}
                    {item.acao_sugerida ? (
                      <p className="mt-2 rounded-lg border border-violet-100 bg-violet-50/70 p-2.5 text-xs font-semibold text-violet-900">
                        <span className="text-violet-600 font-bold uppercase tracking-wider text-[10px] block mb-0.5">
                          Ação recomendada:
                        </span>
                        {item.acao_sugerida}
                      </p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
        <p className="text-xs text-slate-500">{resultado.aviso}</p>
      </CardContent>
    </Card>
  )
}

export default function NexoAssistente() {
  const { user } = useAuth()
  const { perfilSlug } = useIsSuperAdmin()
  const [frenteSelecionada, setFrenteSelecionada] = useState<FrenteCentralNexo>('recomendacoes-dia')
  const [responsavelSelecionado, setResponsavelSelecionado] = useState('todos')
  const [responsaveis, setResponsaveis] = useState<ResponsavelComercialOpcao[]>([])
  const [carregandoResponsaveis, setCarregandoResponsaveis] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState<AnaliseCentralNexoResponse | null>(null)

  const frente = useMemo(
    () => frentesNexo.find((item) => item.id === frenteSelecionada) || frentesNexo[0],
    [frenteSelecionada],
  )
  const IconeAtual = frente.icon
  const podeVisaoGeral = perfisVisaoGeral.has(perfilSlug || '')
  const escopoPrevisto = podeVisaoGeral
    ? responsavelSelecionado === 'todos'
      ? 'Escopo da análise: visão geral da operação comercial'
      : `Escopo da análise: responsável selecionado — ${responsaveis.find((r) => r.id === responsavelSelecionado)?.name || responsavelSelecionado}`
    : `Escopo da análise: seus negócios${user?.name ? ` — ${user.name}` : ''}`

  useEffect(() => {
    if (!podeVisaoGeral) return
    setCarregandoResponsaveis(true)
    listarResponsaveisCentralNexo()
      .then(setResponsaveis)
      .catch(() => setResponsaveis([]))
      .finally(() => setCarregandoResponsaveis(false))
  }, [podeVisaoGeral])

  async function handleGerarAnalise() {
    setProcessando(true)
    setErro('')
    setResultado(null)
    try {
      const resposta = await gerarAnaliseCentralNexo({
        frente: frenteSelecionada,
        responsavel_id:
          podeVisaoGeral && responsavelSelecionado !== 'todos' ? responsavelSelecionado : undefined,
      })
      setResultado(resposta)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível gerar a análise do Nexo.')
    } finally {
      setProcessando(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Inteligência Comercial PMais
          </p>
          <h2 className="mt-1 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
              <Bot aria-hidden="true" className="h-5 w-5" />
            </span>
            Assistente Nexo
          </h2>
          <p className="mt-1.5 text-sm text-slate-600">
            Central operacional para analisar o pipeline real com apoio do Nexo, respeitando perfil
            de acesso, responsável comercial e segundo cérebro do Nexo.
          </p>
        </div>
        <Badge
          variant="outline"
          className="rounded-full border-violet-200/80 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700"
        >
          Análise com IA e contexto real
        </Badge>
      </section>

      <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Relatórios e Simulações
              </p>
              <CardTitle className="text-base font-semibold text-slate-900">
                Relatório da equipe comercial
              </CardTitle>
            </div>
          </div>
          <CardDescription className="text-xs text-slate-500">
            Visão executiva por operadora e modalidade, com volume, valor, ganhos, perdidos, abertos
            e conversões.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2.5 pt-0">
          <Button
            asChild
            size="sm"
            className="bg-violet-600 font-medium text-white shadow-sm hover:bg-violet-700"
          >
            <Link to="/nexo/relatorio-equipe-comercial">Abrir relatório da equipe comercial</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
          >
            <Link to="/nexo/ipcp-simulacao">Análise gerencial do IPCP</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Módulos Consultivos
            </p>
            <CardTitle className="text-base font-semibold text-slate-900">
              Frentes do Assistente Nexo
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Escolha a leitura operacional e processe com o Nexo.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2.5">
            {frentesNexo.map((item) => {
              const Icon = item.icon
              const active = frenteSelecionada === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setFrenteSelecionada(item.id)
                    setResultado(null)
                    setErro('')
                  }}
                  className={`rounded-xl border p-3.5 text-left transition-all duration-150 ${
                    active
                      ? 'border-l-4 border-violet-300 border-l-violet-600 bg-violet-50/60 shadow-sm'
                      : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/70 hover:shadow-sm'
                  }`}
                >
                  <span className="flex items-start gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                        active
                          ? 'bg-violet-600 text-white shadow-sm'
                          : 'bg-violet-50 text-violet-700'
                      }`}
                    >
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-900">
                        {item.titulo}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {item.subtitulo}
                      </span>
                    </span>
                  </span>
                </button>
              )
            })}
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                <IconeAtual aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Frente Selecionada
                </p>
                <CardTitle className="text-lg font-bold text-slate-900">{frente.titulo}</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  {frente.subtitulo}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <section className="rounded-xl border border-slate-200/80 border-l-4 border-l-sky-500 bg-slate-50/50 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
                <BarChart3 aria-hidden="true" className="h-4 w-4 text-sky-600" /> Leitura do Nexo
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{frente.leitura}</p>
            </section>

            <Lista titulo="Perguntas que o Nexo deve responder" itens={frente.perguntas} />
            <Lista titulo="Saída operacional esperada" itens={frente.saida} />

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
                <ListChecks aria-hidden="true" className="h-4 w-4 text-violet-700" />{' '}
                {escopoPrevisto}
              </p>
              {podeVisaoGeral ? (
                <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Filtrar por responsável
                  <select
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal text-slate-800 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    value={responsavelSelecionado}
                    onChange={(event) => setResponsavelSelecionado(event.target.value)}
                    disabled={carregandoResponsaveis || processando}
                  >
                    <option value="todos">Todos os responsáveis</option>
                    {responsaveis.map((responsavel) => (
                      <option key={responsavel.id} value={responsavel.id}>
                        {responsavel.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Seu perfil usa automaticamente apenas os negócios em que você é o responsável
                  comercial.
                </p>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <Button
                onClick={handleGerarAnalise}
                disabled={processando}
                className="w-full bg-violet-600 font-medium text-white shadow-sm hover:bg-violet-700 sm:w-auto"
              >
                {processando ? (
                  <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Lightbulb aria-hidden="true" className="mr-2 h-4 w-4" />
                )}
                {processando ? 'Processando com Nexo...' : 'Gerar análise com Nexo'}
              </Button>
              <p className="text-xs text-slate-500">
                O Nexo não envia mensagens e não altera negócios automaticamente.
              </p>
            </div>
            {erro ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                {erro}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {resultado ? <ResultadoNexo resultado={resultado} /> : null}
    </div>
  )
}
