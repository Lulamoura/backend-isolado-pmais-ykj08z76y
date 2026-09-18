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
    <div>
      <p className="font-semibold text-slate-950">{titulo}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
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
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Resultado da análise do Nexo</CardTitle>
          <Badge variant={resultado.fallback ? 'secondary' : 'default'}>
            {resultado.fallback ? 'Fallback contextual' : 'IA real'}
          </Badge>
          <Badge variant="outline">Provider: {providerLabel(resultado)}</Badge>
          <Badge variant="outline">Modelo: {modeloLabel(resultado)}</Badge>
        </div>
        <CardDescription>
          {resultado.escopo.label} · {resultado.total_negocios} negócio(s) considerados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-white p-4 text-sm leading-6 text-slate-800">
          {blocos.length ? (
            blocos.map((bloco) => <p key={bloco}>{bloco}</p>)
          ) : (
            <p>Sem análise textual retornada.</p>
          )}
        </div>
        {resultado.itens.length ? (
          <div className="space-y-3">
            <p className="font-semibold text-slate-950">Negócios citados</p>
            <div className="grid gap-3">
              {resultado.itens.slice(0, 6).map((item, index) => {
                const idNegocio =
                  item.id_negocio || item.external_id || item.negocio_id || 'Sem ID externo'
                return (
                  <div
                    key={`${item.negocio_id || item.external_id || index}`}
                    className="rounded-xl border bg-white p-4"
                  >
                    <p className="font-semibold text-slate-950">
                      {item.titulo || 'Negócio sem título'}
                    </p>
                    <div className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                      <p>ID do negócio: {idNegocio}</p>
                      <p>Cliente: {item.cliente || 'não informado'}</p>
                      <p>Contato: {item.contato || 'não informado'}</p>
                      <p>Responsável interno: {item.responsavel || 'não informado'}</p>
                    </div>
                    {item.detalhamento_proposta ? (
                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        Detalhamento da proposta: {item.detalhamento_proposta}
                      </p>
                    ) : null}
                    {item.acao_sugerida ? (
                      <p className="mt-2 text-sm font-medium text-violet-800">
                        Ação: {item.acao_sugerida}
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
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <section className="rounded-2xl bg-gradient-to-r from-slate-950 via-violet-950 to-indigo-950 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-violet-200">
              Inteligência Comercial PMais
            </p>
            <h1 className="mt-1 flex items-center gap-3 text-3xl font-extrabold tracking-tight">
              <Bot aria-hidden="true" className="h-8 w-8 text-violet-200" /> Assistente Nexo
            </h1>
            <p className="mt-3 text-sm leading-6 text-violet-100/90">
              Central operacional para analisar o pipeline real com apoio do Nexo, respeitando
              perfil de acesso, responsável comercial e segundo cérebro do Nexo.
            </p>
          </div>
          <Badge className="border-violet-300/50 bg-white/10 text-violet-50 hover:bg-white/10">
            Análise com IA e contexto real
          </Badge>
        </div>
      </section>

      <Card className="border-indigo-200 bg-indigo-50/50">
        <CardHeader>
          <CardTitle>Relatório da equipe comercial</CardTitle>
          <CardDescription>
            Visão executiva por operadora e modalidade, com volume, valor, ganhos, perdidos, abertos
            e conversões.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/nexo/relatorio-equipe-comercial">Abrir relatório da equipe comercial</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/nexo/ipcp-simulacao">Análise gerencial do IPCP</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Frentes do Assistente Nexo</CardTitle>
            <CardDescription>Escolha a leitura operacional e processe com o Nexo.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
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
                  className={`rounded-xl border p-4 text-left transition ${
                    active
                      ? 'border-violet-400 bg-violet-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/40'
                  }`}
                >
                  <span className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block font-semibold text-slate-950">{item.titulo}</span>
                      <span className="mt-1 block text-sm text-slate-600">{item.subtitulo}</span>
                    </span>
                  </span>
                </button>
              )
            })}
          </CardContent>
        </Card>

        <Card className="border-violet-200 bg-violet-50/40">
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <IconeAtual aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <CardTitle>{frente.titulo}</CardTitle>
                <CardDescription>{frente.subtitulo}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 rounded-b-xl bg-white/80 p-5">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="flex items-center gap-2 font-semibold text-slate-950">
                <BarChart3 aria-hidden="true" className="h-4 w-4 text-violet-700" /> Leitura do Nexo
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{frente.leitura}</p>
            </section>

            <Lista titulo="Perguntas que o Nexo deve responder" itens={frente.perguntas} />
            <Lista titulo="Saída operacional esperada" itens={frente.saida} />

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="flex items-center gap-2 font-semibold text-slate-950">
                <ListChecks aria-hidden="true" className="h-4 w-4 text-violet-700" />{' '}
                {escopoPrevisto}
              </p>
              {podeVisaoGeral ? (
                <label className="mt-3 block text-sm font-medium text-slate-700">
                  Filtrar por responsável
                  <select
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
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
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Seu perfil usa automaticamente apenas os negócios em que você é o responsável
                  comercial.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Button
                onClick={handleGerarAnalise}
                disabled={processando}
                className="w-full sm:w-auto"
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
            {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
          </CardContent>
        </Card>
      </div>

      {resultado ? <ResultadoNexo resultado={resultado} /> : null}
    </div>
  )
}
