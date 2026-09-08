import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Mail,
  MessageCircle,
  Mic,
  SearchCheck,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type ContextoId = 'prospect' | 'proposta' | 'negociacao'
type AcaoId =
  | 'analisar-prospect'
  | 'abordagem-inicial'
  | 'follow-up-proposta'
  | 'resumo-reuniao'
  | 'roteiro-ligacao'
  | 'pendencias'
  | 'proximo-passo'

type Acao = {
  id: AcaoId
  titulo: string
  contexto: ContextoId | 'todos'
  descricao: string
  icon: typeof SearchCheck
}

type Sugestao = {
  diagnostico: string[]
  recomendacoes: string[]
  whatsapp: string
  email: string
  roteiro: string[]
  pendencias: string[]
  proximosPassos: string[]
  cuidados: string[]
}

const contextos: Array<{
  id: ContextoId
  titulo: string
  descricao: string
  icon: typeof BriefcaseBusiness
}> = [
  {
    id: 'prospect',
    titulo: 'Prospect ou nova oportunidade',
    descricao: 'Qualificação, primeira abordagem, dados faltantes e prioridade comercial.',
    icon: BriefcaseBusiness,
  },
  {
    id: 'proposta',
    titulo: 'Proposta enviada ou em produção',
    descricao: 'Follow-up, leitura de sinais, objeções, mensagem e próxima ação.',
    icon: FileCheck2,
  },
  {
    id: 'negociacao',
    titulo: 'Negociação em andamento',
    descricao: 'Objeções, retomada, roteiro de ligação, decisão e escalonamento.',
    icon: CalendarClock,
  },
]

const acoes: Acao[] = [
  {
    id: 'analisar-prospect',
    titulo: 'Analisar Prospect',
    contexto: 'prospect',
    descricao: 'Diagnóstico, aderência, lacunas, risco e prioridade de avanço.',
    icon: SearchCheck,
  },
  {
    id: 'abordagem-inicial',
    titulo: 'Sugerir abordagem inicial',
    contexto: 'prospect',
    descricao: 'WhatsApp, e-mail, ligação e perguntas de qualificação.',
    icon: MessageCircle,
  },
  {
    id: 'follow-up-proposta',
    titulo: 'Sugerir follow-up da proposta',
    contexto: 'proposta',
    descricao: 'Régua assistida, canal sugerido, objeções e texto pronto.',
    icon: Mail,
  },
  {
    id: 'resumo-reuniao',
    titulo: 'Registrar resumo de reunião',
    contexto: 'negociacao',
    descricao: 'Resumo, objeções, decisão, dono do próximo passo e data.',
    icon: FileCheck2,
  },
  {
    id: 'roteiro-ligacao',
    titulo: 'Gerar roteiro de ligação',
    contexto: 'negociacao',
    descricao: 'Objetivo, abertura, perguntas, objeções e fechamento datado.',
    icon: Mic,
  },
  {
    id: 'pendencias',
    titulo: 'Identificar pendências',
    contexto: 'todos',
    descricao: 'O que falta antes de avançar, cobrar, revisar ou encerrar.',
    icon: AlertTriangle,
  },
  {
    id: 'proximo-passo',
    titulo: 'Sugerir próximo passo comercial',
    contexto: 'todos',
    descricao: 'Recomendação prática com justificativa e ação do operador.',
    icon: Sparkles,
  },
]

const nomesContexto: Record<ContextoId, string> = {
  prospect: 'Prospect ou nova oportunidade',
  proposta: 'Proposta enviada ou em produção',
  negociacao: 'Negociação em andamento',
}

const exemplosOrientacao: Record<ContextoId, string> = {
  prospect:
    'Ex.: empresa de facilities no Recife, pediu terceirização de limpeza, urgência para iniciar em 20 dias, ainda sem quantidade de postos.',
  proposta:
    'Ex.: proposta enviada há 5 dias, cliente abriu o link, questionou prazo de mobilização e pediu retorno por WhatsApp.',
  negociacao:
    'Ex.: cliente achou o valor alto, comparou com fornecedor informal e precisa decidir até sexta-feira.',
}

function limparEntrada(texto: string) {
  return texto.trim().replace(/\s+/g, ' ')
}

function detalheOperador(orientacao: string) {
  const texto = limparEntrada(orientacao)
  return texto || 'nenhum detalhe complementar informado pelo operador'
}

function sugestaoPorAcao(
  contexto: ContextoId,
  acao: Acao,
  orientacao: string,
  contador: number,
): Sugestao {
  const detalhe = detalheOperador(orientacao)
  const rodada = contador > 1 ? `Rodada ${contador}: ` : ''

  if (acao.id === 'follow-up-proposta') {
    return {
      diagnostico: [
        `${rodada}A situação deve ser tratada como follow-up de proposta, não como nova venda.`,
        'O melhor uso do Nexo aqui é reduzir silêncio comercial: recuperar o valor da proposta, remover dúvida objetiva e obter uma próxima data.',
        `Contexto considerado: ${detalhe}.`,
      ],
      recomendacoes: [
        'Usar primeiro o canal mais recente do cliente; se a conversa anterior foi WhatsApp, evitar e-mail longo.',
        'Não pressionar com urgência artificial; pedir uma resposta simples: dúvida, ajuste ou próxima conversa.',
        'Se houver objeção de preço, retomar escopo, risco operacional e critérios de qualidade antes de falar em desconto.',
      ],
      whatsapp:
        'Olá, [Nome]. Passando para retomar a proposta da PMais e entender se ficou alguma dúvida objetiva sobre escopo, prazo de mobilização ou formato da operação. Se fizer sentido, posso ajustar com você os pontos pendentes e deixamos o próximo passo definido.',
      email:
        'Assunto: Retomada da proposta PMais\n\nOlá, [Nome].\n\nRetomo a proposta enviada pela PMais para confirmar se o escopo e o prazo de mobilização ficaram claros. Caso exista algum ponto em aberto — valor, cobertura, quantidade de postos ou início da operação — posso consolidar os ajustes e alinhar o próximo passo com você.\n\nFaz sentido conversarmos ainda esta semana?',
      roteiro: [
        'Abrir confirmando que a ligação é para tirar dúvidas da proposta, não para pressionar decisão.',
        'Perguntar: “qual ponto ainda impede o avanço?”',
        'Se o bloqueio for preço, comparar escopo e risco, não apenas valor mensal.',
        'Encerrar com uma data: nova reunião, ajuste de proposta ou encerramento manual.',
      ],
      pendencias: [
        'Data de envio da proposta.',
        'Evidência de abertura/leitura, quando disponível.',
        'Último canal usado pelo cliente.',
        'Objeção principal registrada.',
        'Responsável PMais pelo próximo contato.',
      ],
      proximosPassos: [
        'Enviar mensagem curta pelo canal mais recente.',
        'Se não houver resposta, programar nova tentativa em 2 dias úteis.',
        'Registrar a objeção ou ausência de retorno no histórico da proposta.',
      ],
      cuidados: [
        'Não prometer desconto, prazo de mobilização ou disponibilidade sem validação interna.',
        'Não enviar automaticamente; o operador revisa e decide.',
      ],
    }
  }

  if (acao.id === 'abordagem-inicial') {
    return {
      diagnostico: [
        `${rodada}A abordagem inicial precisa qualificar necessidade antes de vender solução.`,
        'O valor cultural para o time vem de transformar contato solto em conversa objetiva: necessidade, urgência, local, decisor e próximo passo.',
        `Contexto considerado: ${detalhe}.`,
      ],
      recomendacoes: [
        'Começar com uma pergunta de contexto, não com apresentação longa da PMais.',
        'Evitar promessa ampla; posicionar a PMais como apoio para operação, terceirização e gestão de equipes.',
        'Buscar uma microconversão: confirmar dados ou agendar conversa breve.',
      ],
      whatsapp:
        'Olá, [Nome]. Vi seu contato sobre apoio da PMais. Para eu direcionar corretamente: a necessidade é limpeza, portaria, apoio administrativo ou outro tipo de terceirização? Se puder, me diga também local, prazo desejado e quantidade aproximada de postos.',
      email:
        'Assunto: Entendimento inicial da necessidade\n\nOlá, [Nome].\n\nObrigado pelo contato com a PMais. Para direcionarmos a conversa com objetividade, preciso entender três pontos: tipo de serviço, local da operação e prazo esperado para início. Com isso conseguimos avaliar o melhor encaminhamento comercial.\n\nPodemos alinhar esses pontos por e-mail ou em uma conversa breve?',
      roteiro: [
        'Confirmar serviço desejado e cidade/bairro da operação.',
        'Perguntar urgência e motivo da contratação.',
        'Identificar decisor e quem participa da validação.',
        'Combinar envio de dados ou reunião de diagnóstico.',
      ],
      pendencias: [
        'Tipo de serviço.',
        'Local de execução.',
        'Prazo desejado.',
        'Volume aproximado da demanda.',
        'Decisor ou área responsável.',
      ],
      proximosPassos: [
        'Completar dados mínimos de qualificação.',
        'Definir se vira Prospect qualificado ou se precisa de triagem adicional.',
        'Registrar origem/campanha quando disponível.',
      ],
      cuidados: [
        'Não criar expectativa de preço antes de escopo mínimo.',
        'Não tratar contato sem dados mínimos como proposta pronta.',
      ],
    }
  }

  if (acao.id === 'analisar-prospect') {
    return {
      diagnostico: [
        `${rodada}O Prospect deve ser avaliado por aderência, urgência e completude de dados.`,
        'O Nexo deve ajudar o operador a decidir se avança, pede mais informação, encaminha para outra área ou encerra manualmente.',
        `Contexto considerado: ${detalhe}.`,
      ],
      recomendacoes: [
        'Priorizar Prospects com dor operacional clara, local atendível e prazo definido.',
        'Marcar como pendente quando faltar escopo mínimo, em vez de avançar com proposta frágil.',
        'Separar pedido comercial real de RH, fornecedor, administrativo ou contato institucional.',
      ],
      whatsapp:
        'Olá, [Nome]. Para avançarmos corretamente com sua solicitação, preciso confirmar serviço, local, prazo esperado e melhor contato para alinhamento. Com essas informações conseguimos avaliar o encaminhamento comercial mais adequado.',
      email:
        'Assunto: Dados para avaliação comercial PMais\n\nOlá, [Nome].\n\nPara avaliarmos sua demanda, preciso confirmar algumas informações: serviço pretendido, local da operação, prazo desejado, volume estimado e responsável pela decisão. Assim evitamos uma proposta incompleta e direcionamos melhor o atendimento.\n\nPode me enviar esses dados?',
      roteiro: [
        'Validar se a demanda é comercial e se pertence ao escopo PMais.',
        'Checar urgência real e critérios de decisão.',
        'Mapear riscos: informação faltante, prazo inviável, serviço fora do escopo ou contato não decisor.',
      ],
      pendencias: [
        'Serviço e local.',
        'Quantidade/escopo aproximado.',
        'Prazo de início.',
        'Contato decisor.',
        'Origem de prospecção.',
      ],
      proximosPassos: [
        'Classificar como avançar, pendente de dados, encaminhar ou encerrar.',
        'Registrar lacunas antes de acionar proposta.',
      ],
      cuidados: [
        'Não desqualificar automaticamente.',
        'Não criar CRM paralelo; registrar no fluxo oficial do app/ActiveCampaign.',
      ],
    }
  }

  if (acao.id === 'resumo-reuniao') {
    return {
      diagnostico: [
        `${rodada}A reunião precisa virar decisão operacional, não apenas anotação solta.`,
        'O registro útil para cultura comercial contém objeção, dono do próximo passo e data combinada.',
        `Contexto considerado: ${detalhe}.`,
      ],
      recomendacoes: [
        'Separar fatos discutidos de interpretação do vendedor.',
        'Registrar objeções na linguagem do cliente.',
        'Nunca sair sem dono e data do próximo passo.',
      ],
      whatsapp:
        'Olá, [Nome]. Obrigado pela conversa de hoje. Conforme alinhamos, vou consolidar os pontos discutidos e retorno com o próximo encaminhamento até [data]. Se algum ponto tiver ficado diferente do combinado, pode me sinalizar.',
      email:
        'Assunto: Resumo e próximos passos\n\nOlá, [Nome].\n\nConsolidando nossa reunião: discutimos [resumo], ficaram como pontos de atenção [objeções] e o próximo passo combinado foi [ação], sob responsabilidade de [dono], até [data].\n\nSeguimos por esse caminho?',
      roteiro: [
        'Resumo em 2 a 4 linhas.',
        'Objeções ou dúvidas do cliente.',
        'Próximo passo.',
        'Dono do próximo passo.',
        'Data prevista e temperatura do negócio.',
      ],
      pendencias: [
        'Participantes.',
        'Objeções literais.',
        'Dono do próximo passo.',
        'Data combinada.',
      ],
      proximosPassos: [
        'Salvar resumo no histórico quando o gate for liberado.',
        'Programar follow-up se o próximo passo estiver com o cliente.',
      ],
      cuidados: [
        'Não transformar anotação em compromisso comercial sem revisão.',
        'Não registrar dado sensível desnecessário.',
      ],
    }
  }

  if (acao.id === 'roteiro-ligacao') {
    return {
      diagnostico: [
        `${rodada}A ligação deve ter objetivo único: desbloquear decisão, não repetir a proposta inteira.`,
        'O roteiro precisa conduzir abertura, pergunta central, tratamento de objeção e fechamento com data.',
        `Contexto considerado: ${detalhe}.`,
      ],
      recomendacoes: [
        'Começar pedindo permissão para ser objetivo.',
        'Fazer uma pergunta aberta sobre o bloqueio atual.',
        'Encerrar com próximo passo mensurável.',
      ],
      whatsapp:
        'Olá, [Nome]. Queria falar rapidamente para entender qual ponto ainda está pendente na proposta e combinar o melhor próximo passo. Posso te ligar em [horário]?',
      email:
        'Assunto: Alinhamento rápido sobre a proposta\n\nOlá, [Nome].\n\nPara evitar troca longa de mensagens, sugiro uma conversa rápida para entendermos o ponto pendente e definirmos o próximo passo. Posso te ligar em [opções de horário]?',
      roteiro: [
        'Abertura: “vou ser objetivo para respeitar seu tempo”.',
        'Pergunta central: “o que falta para vocês decidirem?”',
        'Explorar objeção: preço, prazo, escopo, comparação ou prioridade interna.',
        'Fechar: ajuste de proposta, reunião com decisor, nova data ou encerramento manual.',
      ],
      pendencias: [
        'Nome do decisor.',
        'Bloqueio principal.',
        'Prazo de decisão.',
        'Concorrente/comparativo, se houver.',
      ],
      proximosPassos: ['Registrar resultado da ligação.', 'Criar follow-up com dono e data.'],
      cuidados: [
        'Não transformar ligação em pressão comercial.',
        'Não negociar condição sem limite autorizado.',
      ],
    }
  }

  if (acao.id === 'pendencias') {
    return {
      diagnostico: [
        `${rodada}Pendência boa é verificável e acionável.`,
        `Para ${nomesContexto[contexto]}, o Nexo deve apontar o que impede avanço seguro.`,
        `Contexto considerado: ${detalhe}.`,
      ],
      recomendacoes: [
        'Separar pendência de dados, pendência de decisão e pendência de ação PMais.',
        'Priorizar o que bloqueia proposta, follow-up ou avanço de etapa.',
        'Transformar cada pendência em uma pergunta ou tarefa.',
      ],
      whatsapp:
        'Olá, [Nome]. Para darmos sequência, preciso confirmar alguns pontos que ficaram pendentes: [ponto 1], [ponto 2] e [ponto 3]. Com isso consigo te retornar com mais precisão.',
      email:
        'Assunto: Pontos pendentes para sequência\n\nOlá, [Nome].\n\nAntes de avançarmos, ficaram alguns pontos pendentes que preciso confirmar: [lista]. Assim evitamos encaminhamento incompleto e seguimos com a decisão correta.\n\nPode me retornar com essas informações?',
      roteiro: [
        'Listar pendência.',
        'Identificar dono.',
        'Definir prazo.',
        'Decidir se bloqueia avanço ou apenas complementa histórico.',
      ],
      pendencias: [
        'Informação comercial mínima.',
        'Próxima ação sem dono.',
        'Data prometida ausente ou vencida.',
        'Objeção sem resposta registrada.',
        'Canal de retorno indefinido.',
      ],
      proximosPassos: [
        'Resolver pendências bloqueantes primeiro.',
        'Registrar as demais como tarefas ou observações.',
      ],
      cuidados: [
        'Não avançar etapa se o dado pendente muda preço, prazo ou escopo.',
        'Não inventar dado ausente.',
      ],
    }
  }

  return {
    diagnostico: [
      `${rodada}O próximo passo deve reduzir incerteza e preservar controle humano.`,
      `Para ${nomesContexto[contexto]}, a decisão recomendada depende de dados mínimos, urgência, objeções e dono da ação.`,
      `Contexto considerado: ${detalhe}.`,
    ],
    recomendacoes: [
      'Escolher uma ação simples que mova o negócio: pedir dado, ligar, ajustar proposta, agendar conversa ou encerrar manualmente.',
      'Não confundir ausência de resposta com perda automática.',
      'Registrar a justificativa para criar aprendizagem comercial.',
    ],
    whatsapp:
      'Olá, [Nome]. Para seguirmos de forma objetiva, proponho alinharmos o próximo passo: confirmar os pontos pendentes, ajustar a proposta se necessário ou marcar uma conversa rápida para decisão. Qual caminho faz mais sentido para você?',
    email:
      'Assunto: Próximo passo\n\nOlá, [Nome].\n\nPara conduzirmos o processo com clareza, sugiro definirmos o próximo passo: validação dos pontos pendentes, ajuste de proposta ou conversa rápida para decisão. Assim evitamos deixar a oportunidade parada sem encaminhamento.\n\nQual alternativa funciona melhor para vocês?',
    roteiro: [
      'Confirmar situação atual.',
      'Apontar a pendência principal.',
      'Oferecer duas alternativas de avanço.',
      'Fechar com responsável e data.',
    ],
    pendencias: [
      'Situação atual do cliente.',
      'Barreira principal.',
      'Dono da próxima ação.',
      'Data de retorno.',
    ],
    proximosPassos: [
      'Executar a menor ação capaz de gerar resposta.',
      'Registrar resultado e reavaliar em até 2 dias úteis quando houver silêncio.',
    ],
    cuidados: [
      'Manter a decisão com o operador.',
      'Não alterar etapa nem enviar mensagem automaticamente.',
    ],
  }
}

function Lista({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <div>
      <p className="font-semibold text-slate-950">{titulo}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
        {itens.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

export default function NexoAssistente() {
  const [contextoSelecionado, setContextoSelecionado] = useState<ContextoId | ''>('')
  const [acaoSelecionada, setAcaoSelecionada] = useState<AcaoId | ''>('')
  const [orientacao, setOrientacao] = useState('')
  const [sugestao, setSugestao] = useState<Sugestao | null>(null)
  const [contadorSugestoes, setContadorSugestoes] = useState(0)

  const acoesDisponiveis = useMemo(
    () =>
      acoes.filter(
        (acao) =>
          !contextoSelecionado ||
          acao.contexto === 'todos' ||
          acao.contexto === contextoSelecionado,
      ),
    [contextoSelecionado],
  )
  const acaoAtual = acoes.find((acao) => acao.id === acaoSelecionada)
  const podeGerar = Boolean(contextoSelecionado && acaoAtual)

  function selecionarContexto(contexto: ContextoId) {
    setContextoSelecionado(contexto)
    setAcaoSelecionada('')
    setSugestao(null)
  }

  function selecionarAcao(acao: AcaoId) {
    setAcaoSelecionada(acao)
    setSugestao(null)
  }

  function gerarSugestao() {
    if (!contextoSelecionado || !acaoAtual) return
    const proximaRodada = contadorSugestoes + 1
    setSugestao(sugestaoPorAcao(contextoSelecionado, acaoAtual, orientacao, proximaRodada))
    setContadorSugestoes(proximaRodada)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 via-violet-900 to-indigo-900 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-violet-200">
              Inteligência Comercial - PMais
            </p>
            <h2 className="mt-1 flex items-center gap-3 text-3xl font-extrabold tracking-tight">
              <Bot aria-hidden="true" className="h-8 w-8 text-violet-200" /> Assistente Nexo
            </h2>
            <p className="mt-3 text-sm leading-6 text-violet-100/90">
              Apoio comercial para analisar oportunidades, sugerir abordagens, organizar follow-ups
              e preparar mensagens. O Nexo recomenda; o operador valida antes de qualquer contato
              com o cliente.
            </p>
          </div>
          <Badge className="border-violet-300/50 bg-white/10 text-violet-50 hover:bg-white/10">
            Sem envio automático
          </Badge>
        </div>
      </section>

      <Alert className="border-amber-200 bg-amber-50 text-amber-900">
        <ShieldCheck aria-hidden="true" className="h-4 w-4" />
        <AlertTitle>Regra de segurança do MVP</AlertTitle>
        <AlertDescription>
          Esta versão gera orientação comercial ampla o suficiente para ser útil ao time, mas ainda
          mantém segurança: não envia mensagem, não altera etapa, não desqualifica automaticamente e
          não substitui a decisão do operador.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>1. Escolha o contexto comercial</CardTitle>
            <CardDescription>
              Quando o Nexo for aberto a partir de um registro, esta seleção virá preenchida. Pelo
              menu geral, o operador escolhe antes de agir.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {contextos.map((contexto) => {
              const Icon = contexto.icon
              const active = contextoSelecionado === contexto.id
              return (
                <button
                  key={contexto.id}
                  type="button"
                  onClick={() => selecionarContexto(contexto.id)}
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
                      <span className="block font-semibold text-slate-950">{contexto.titulo}</span>
                      <span className="mt-1 block text-sm text-slate-600">
                        {contexto.descricao}
                      </span>
                    </span>
                  </span>
                </button>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Escolha a ação guiada</CardTitle>
            <CardDescription>
              O catálogo combina follow-up comercial, abordagem assistida, roteiros e próximos
              passos dentro das diretrizes da PMais.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {acoesDisponiveis.map((acao) => {
              const Icon = acao.icon
              const active = acaoSelecionada === acao.id
              return (
                <button
                  key={acao.id}
                  type="button"
                  onClick={() => selecionarAcao(acao.id)}
                  className={`rounded-xl border p-4 text-left transition ${
                    active
                      ? 'border-violet-400 bg-violet-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/40'
                  }`}
                >
                  <Icon aria-hidden="true" className="mb-3 h-5 w-5 text-violet-700" />
                  <span className="block font-semibold text-slate-950">{acao.titulo}</span>
                  <span className="mt-1 block text-sm text-slate-600">{acao.descricao}</span>
                </button>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>3. Informe o caso concreto</CardTitle>
          <CardDescription>
            Quanto mais contexto o operador colocar aqui, mais útil fica a sugestão. Nesta fase o
            Nexo ainda não consulta automaticamente o registro real.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="nexo-orientacao">Orientação para o Nexo</Label>
          <Textarea
            id="nexo-orientacao"
            value={orientacao}
            onChange={(event) => {
              setOrientacao(event.target.value)
              setSugestao(null)
            }}
            placeholder={
              contextoSelecionado
                ? exemplosOrientacao[contextoSelecionado]
                : 'Escolha um contexto para ver um exemplo.'
            }
            className="min-h-28"
          />
        </CardContent>
      </Card>

      <Card className="border-violet-200 bg-violet-50/50">
        <CardHeader>
          <CardTitle>Prévia da sugestão assistida</CardTitle>
          <CardDescription>
            O botão agora gera uma saída prática: diagnóstico, recomendações, WhatsApp, e-mail,
            roteiro, pendências, próximos passos e cuidados de segurança.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!sugestao && (
            <p className="rounded-xl border border-dashed border-violet-200 bg-white p-4 text-sm text-slate-600">
              Selecione contexto e ação. Depois clique em Gerar sugestão assistida para montar uma
              orientação comercial revisável pelo operador.
            </p>
          )}

          {sugestao && acaoAtual && contextoSelecionado && (
            <div className="space-y-5 rounded-xl border border-violet-200 bg-white p-5 text-sm leading-6 text-slate-700">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                    Sugestão gerada para {nomesContexto[contextoSelecionado]}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-slate-950">{acaoAtual.titulo}</h3>
                </div>
                <Badge variant="outline" className="border-violet-200 text-violet-700">
                  Revisão humana obrigatória
                </Badge>
              </div>

              <Lista titulo="Diagnóstico comercial" itens={sugestao.diagnostico} />
              <Lista titulo="Recomendações do Nexo" itens={sugestao.recomendacoes} />

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-950">Mensagem WhatsApp sugerida</p>
                  <p className="mt-2 whitespace-pre-line text-slate-700">{sugestao.whatsapp}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-950">E-mail sugerido</p>
                  <p className="mt-2 whitespace-pre-line text-slate-700">{sugestao.email}</p>
                </div>
              </div>

              <Lista titulo="Roteiro de ligação" itens={sugestao.roteiro} />
              <Lista titulo="Pendências a conferir" itens={sugestao.pendencias} />
              <Lista titulo="Próximos passos" itens={sugestao.proximosPassos} />
              <Lista titulo="Cuidados antes de usar" itens={sugestao.cuidados} />

              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                <AlertTitle>Valor esperado para o time</AlertTitle>
                <AlertDescription>
                  A sugestão já entrega material de trabalho para o operador revisar, adaptar e
                  usar. A próxima evolução será conectar esta resposta aos dados reais do Prospect
                  ou da Proposta.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button disabled={!podeGerar} onClick={gerarSugestao}>
              <Sparkles aria-hidden="true" className="mr-2 h-4 w-4" /> Gerar sugestão assistida
            </Button>
            <Button variant="outline" disabled>
              <ClipboardList aria-hidden="true" className="mr-2 h-4 w-4" /> Salvar no histórico —
              gate futuro
            </Button>
            <Button variant="outline" disabled>
              Copiar mensagem — gate futuro
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
