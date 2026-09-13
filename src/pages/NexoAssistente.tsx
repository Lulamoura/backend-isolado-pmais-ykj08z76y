import { useMemo, useState } from 'react'
import {
  BarChart3,
  BookOpenCheck,
  Bot,
  CalendarClock,
  FileClock,
  Lightbulb,
  ListChecks,
  NotebookPen,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  ThermometerSun,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const frentesNexo = [
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
      'Que práticas de notas/follow-up ajudaram a destravar negócios?',
    ],
    saida: [
      'síntese executiva para Lula/gestão;',
      'orientações práticas para o time;',
      'temas que devem virar playbook do Nexo.',
    ],
  },
] as const

type FrenteId = (typeof frentesNexo)[number]['id']

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

export default function NexoAssistente() {
  const [frenteSelecionada, setFrenteSelecionada] = useState<FrenteId>('recomendacoes-dia')
  const frente = useMemo(
    () => frentesNexo.find((item) => item.id === frenteSelecionada) || frentesNexo[0],
    [frenteSelecionada],
  )
  const IconeAtual = frente.icon

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
              Central operacional para enxergar o pipeline, priorizar riscos e transformar sinais do
              dia em ações comerciais. Os botões nos cards continuam resolvendo o caso individual; o
              menu do Nexo passa a cuidar da visão geral.
            </p>
          </div>
          <Badge className="border-violet-300/50 bg-white/10 text-violet-50 hover:bg-white/10">
            Visão gerencial e operacional
          </Badge>
        </div>
      </section>

      <Alert className="border-amber-200 bg-amber-50 text-amber-900">
        <ShieldCheck aria-hidden="true" className="h-4 w-4" />
        <AlertTitle>Escopo seguro desta fase</AlertTitle>
        <AlertDescription>
          Esta central organiza as frentes de análise do Nexo. Ela não envia mensagens, não altera
          negócios, não cria CRM paralelo e não substitui a decisão humana. A conexão automática com
          os indicadores reais do pipeline fica preparada para a próxima etapa.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Frentes do Assistente Nexo</CardTitle>
            <CardDescription>
              Escolha qual leitura operacional o Nexo deve apoiar no pipeline comercial.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {frentesNexo.map((item) => {
              const Icon = item.icon
              const active = frenteSelecionada === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFrenteSelecionada(item.id)}
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="flex items-center gap-2 font-semibold text-slate-950">
                  <ListChecks aria-hidden="true" className="h-4 w-4 text-violet-700" /> Próxima
                  etapa
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Conectar esta frente aos dados reais do pipeline e gerar a lista de negócios com
                  prioridade, justificativa e ação sugerida.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="flex items-center gap-2 font-semibold text-slate-950">
                  <RefreshCw aria-hidden="true" className="h-4 w-4 text-violet-700" /> Atualização
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Nesta fase, a central define a finalidade operacional. A automação de leitura
                  diária será conectada sem envio automático e com auditoria.
                </p>
              </div>
            </div>

            <Button disabled variant="outline">
              <Lightbulb aria-hidden="true" className="mr-2 h-4 w-4" /> Gerar painel com dados reais
              — próxima etapa
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
