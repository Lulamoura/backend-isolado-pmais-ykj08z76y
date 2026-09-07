import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  BriefcaseBusiness,
  CalendarClock,
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

const contextos = [
  {
    id: 'prospect',
    titulo: 'Prospect ou nova oportunidade',
    descricao: 'Qualificação, primeira abordagem e dados faltantes.',
    icon: BriefcaseBusiness,
  },
  {
    id: 'proposta',
    titulo: 'Proposta enviada ou em produção',
    descricao: 'Follow-up, mensagem, leitura, pendências e próxima ação.',
    icon: FileCheck2,
  },
  {
    id: 'negociacao',
    titulo: 'Negociação em andamento',
    descricao: 'Objeções, retomada, ligação e decisão comercial.',
    icon: CalendarClock,
  },
]

const acoes = [
  {
    id: 'analisar-prospect',
    titulo: 'Analisar Prospect',
    contexto: 'prospect',
    descricao: 'Resumo, pontos favoráveis, atenção, lacunas e próxima ação.',
    icon: SearchCheck,
  },
  {
    id: 'abordagem-inicial',
    titulo: 'Sugerir abordagem inicial',
    contexto: 'prospect',
    descricao: 'WhatsApp, e-mail ou ligação com base na necessidade registrada.',
    icon: MessageCircle,
  },
  {
    id: 'follow-up-proposta',
    titulo: 'Sugerir follow-up da proposta',
    contexto: 'proposta',
    descricao: 'Régua assistida, canal sugerido e texto pronto para revisar.',
    icon: Mail,
  },
  {
    id: 'resumo-reuniao',
    titulo: 'Registrar resumo de reunião',
    contexto: 'negociacao',
    descricao: 'Resumo, objeções, dono do próximo passo, data e temperatura.',
    icon: FileCheck2,
  },
  {
    id: 'roteiro-ligacao',
    titulo: 'Gerar roteiro de ligação',
    contexto: 'negociacao',
    descricao: 'Objetivo, abertura, perguntas-chave, objeções e fechamento.',
    icon: Mic,
  },
  {
    id: 'pendencias',
    titulo: 'Identificar pendências',
    contexto: 'todos',
    descricao: 'Dados, ações ou decisões faltantes antes do avanço comercial.',
    icon: AlertTriangle,
  },
  {
    id: 'proximo-passo',
    titulo: 'Sugerir próximo passo comercial',
    contexto: 'todos',
    descricao: 'Recomendação assistida com justificativa curta e segura.',
    icon: Sparkles,
  },
]

const exemplosPorAcao: Record<string, string> = {
  'analisar-prospect':
    'O Nexo vai apontar dados faltantes, aderência inicial, riscos comerciais e uma recomendação assistida: avançar, manter condicional, pedir informação ou desqualificar manualmente.',
  'abordagem-inicial':
    'Sugestão segura: mensagem curta para confirmar necessidade, prazo, local e melhor horário de conversa. Sem promessa de preço, disponibilidade ou prazo de mobilização sem validação.',
  'follow-up-proposta':
    'Sugestão segura: retomar a proposta enviada, mencionar o ponto principal de valor, perguntar se há dúvida objetiva e propor uma próxima conversa. O operador revisa e envia manualmente.',
  'resumo-reuniao':
    'Registro sugerido: participantes, estágio, resumo em 2 a 4 linhas, objeções, próximo passo, dono do próximo passo, data prevista e temperatura do negócio.',
  'roteiro-ligacao':
    'Roteiro sugerido: objetivo da ligação, abertura cordial, perguntas sobre decisão e prazo, tratamento das objeções já registradas e fechamento com próxima ação datada.',
  pendencias:
    'O Nexo vai listar apenas pendências verificáveis: próxima ação ausente, data prometida vencida, proposta sem evidência de envio, objeção sem resposta ou contato sem canal alternativo.',
  'proximo-passo':
    'Recomendação segura: agir, aguardar data combinada, pedir dado faltante, escalar para gestão, preparar/revisar proposta ou sugerir encerramento manual quando cabível.',
}

export default function NexoAssistente() {
  const [contextoSelecionado, setContextoSelecionado] = useState('')
  const [acaoSelecionada, setAcaoSelecionada] = useState('')
  const [orientacao, setOrientacao] = useState('')

  const acoesDisponiveis = useMemo(
    () =>
      acoes.filter(
        (acao) =>
          !contextoSelecionado || acao.contexto === 'todos' || acao.contexto === contextoSelecionado,
      ),
    [contextoSelecionado],
  )
  const acaoAtual = acoes.find((acao) => acao.id === acaoSelecionada)
  const podeSimular = Boolean(contextoSelecionado && acaoSelecionada)

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 via-violet-900 to-indigo-900 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-violet-200">
              MVP assistido e contextual
            </p>
            <h2 className="mt-1 flex items-center gap-3 text-3xl font-extrabold tracking-tight">
              <Bot aria-hidden="true" className="h-8 w-8 text-violet-200" /> Assistente Nexo
            </h2>
            <p className="mt-3 text-sm leading-6 text-violet-100/90">
              Apoio comercial para analisar oportunidades, sugerir abordagens, organizar
              follow-ups e preparar mensagens. O Nexo recomenda; o operador valida antes de
              qualquer contato com o cliente.
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
          Esta tela é a primeira porta do Nexo: ações guiadas, contexto obrigatório e saída
          revisável. Não há campanha autônoma, alteração automática de etapa, desqualificação
          automática ou envio direto ao cliente.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>1. Escolha o contexto comercial</CardTitle>
            <CardDescription>
              Quando o Nexo for aberto a partir de um registro, esta seleção virá preenchida.
              Pelo menu geral, o operador escolhe antes de agir.
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
                  onClick={() => {
                    setContextoSelecionado(contexto.id)
                    setAcaoSelecionada('')
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
                      <span className="block font-semibold text-slate-950">{contexto.titulo}</span>
                      <span className="mt-1 block text-sm text-slate-600">{contexto.descricao}</span>
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
              O catálogo inicial combina follow-up comercial, abordagem assistida e próximos
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
                  onClick={() => setAcaoSelecionada(acao.id)}
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
          <CardTitle>3. Orientação complementar do operador</CardTitle>
          <CardDescription>
            Campo opcional para informar objeção, tom desejado, canal preferido ou detalhe da
            conversa. Não substitui o contexto do registro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="nexo-orientacao">Orientação para o Nexo</Label>
          <Textarea
            id="nexo-orientacao"
            value={orientacao}
            onChange={(event) => setOrientacao(event.target.value)}
            placeholder="Ex.: cliente abriu a proposta, mas questionou prazo de mobilização. Preparar uma retomada curta por WhatsApp."
          />
        </CardContent>
      </Card>

      <Card className="border-violet-200 bg-violet-50/50">
        <CardHeader>
          <CardTitle>Prévia controlada da resposta</CardTitle>
          <CardDescription>
            Nesta primeira porta, a resposta é demonstrativa. A integração real do Nexo deve ser
            liberada em gate posterior, com auditoria e permissões.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {podeSimular && acaoAtual ? (
            <div className="rounded-xl border border-violet-200 bg-white p-4 text-sm leading-6 text-slate-700">
              <p className="font-semibold text-slate-950">{acaoAtual.titulo}</p>
              <p className="mt-2">{exemplosPorAcao[acaoAtual.id]}</p>
              {orientacao.trim() && (
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-slate-600">
                  Orientação considerada: {orientacao.trim()}
                </p>
              )}
              <p className="mt-3 font-medium text-violet-800">
                Saída assistida: revisar antes de copiar, salvar no histórico ou enviar por canal
                externo.
              </p>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-violet-200 bg-white p-4 text-sm text-slate-600">
              Selecione um contexto comercial e uma ação guiada para ver a prévia segura do Nexo.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!podeSimular}>
              <Sparkles aria-hidden="true" className="mr-2 h-4 w-4" /> Gerar sugestão assistida
            </Button>
            <Button variant="outline" disabled>
              Salvar no histórico — gate futuro
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
