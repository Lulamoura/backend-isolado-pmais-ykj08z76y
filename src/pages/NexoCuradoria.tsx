import { useEffect, useState } from 'react'
import { AlertCircle, Bot, CheckCircle2, MessageSquareText, ShieldCheck } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  obterResumoCuradoriaNexo,
  salvarEntrevistaCuradoriaNexo,
  type NexoCuradoriaEvento,
  type NexoCuradoriaResumo,
} from '@/services/nexo-curadoria'

function dataCurta(value?: string) {
  if (!value) return 'sem data'
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return 'sem data'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function resumoEvento(evento: NexoCuradoriaEvento) {
  const acao = evento.acao?.replace(/_/g, ' ') || 'consulta do Nexo'
  const partes = [
    evento.empresa_nome || evento.negocio_titulo || 'Empresa não informada',
    evento.contato_nome || 'Contato não informado',
    evento.external_id ? `Negócio ${evento.external_id}` : 'Negócio não identificado',
  ]
  return `${partes.join(' · ')} · ${acao}`
}

const perguntasEntrevista = [
  'Qual regra comercial precisa ser confirmada neste caso?',
  'Existe alguma exceção ou condição que o Nexo deve considerar?',
  'Quem é o responsável pela decisão ou validação final deste alinhamento?',
]

export default function NexoCuradoria() {
  const [resumo, setResumo] = useState<NexoCuradoriaResumo>({ pendencias: 0, itens: [] })
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [entrevistaAberta, setEntrevistaAberta] = useState(false)
  const [etapaEntrevista, setEtapaEntrevista] = useState(0)
  const [respostasEntrevista, setRespostasEntrevista] = useState<string[]>([])
  const [pendenciaSelecionada, setPendenciaSelecionada] = useState<NexoCuradoriaEvento | null>(null)
  const [salvandoEntrevista, setSalvandoEntrevista] = useState(false)
  const [entrevistaSalva, setEntrevistaSalva] = useState(false)

  function iniciarCuradoria(item?: NexoCuradoriaEvento) {
    setPendenciaSelecionada(item || resumo.itens[0] || null)
    setEntrevistaAberta(true)
    setEtapaEntrevista(0)
    setRespostasEntrevista([])
    setEntrevistaSalva(false)
    setErro(null)
  }

  function fecharEntrevista() {
    setEntrevistaAberta(false)
    setEtapaEntrevista(0)
    setRespostasEntrevista([])
    setPendenciaSelecionada(null)
    setEntrevistaSalva(false)
  }

  function atualizarRespostaEntrevista(valor: string) {
    setRespostasEntrevista((atuais) => {
      const proximas = [...atuais]
      proximas[etapaEntrevista - 1] = valor
      return proximas
    })
  }

  async function avancarEntrevista() {
    if (etapaEntrevista === perguntasEntrevista.length) {
      if (!pendenciaSelecionada) {
        setErro('Selecione uma pendência antes de enviar a entrevista para revisão.')
        return
      }
      setSalvandoEntrevista(true)
      try {
        await salvarEntrevistaCuradoriaNexo({
          evento: pendenciaSelecionada,
          perguntas: perguntasEntrevista,
          respostas: respostasEntrevista,
        })
        setEntrevistaSalva(true)
        setEtapaEntrevista(perguntasEntrevista.length + 1)
        setErro(null)
      } catch (_) {
        setErro('Não foi possível enviar a entrevista para revisão agora.')
      } finally {
        setSalvandoEntrevista(false)
      }
      return
    }
    setEtapaEntrevista((atual) => Math.min(atual + 1, perguntasEntrevista.length + 1))
  }

  useEffect(() => {
    let ativo = true
    setLoading(true)
    obterResumoCuradoriaNexo(8)
      .then((data) => {
        if (!ativo) return
        setResumo(data)
        setErro(null)
      })
      .catch(() => {
        if (!ativo) return
        setErro('Não foi possível carregar as pendências de curadoria agora.')
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })
    return () => {
      ativo = false
    }
  }, [])

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <Badge className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100">
              Curadoria do conhecimento operacional
            </Badge>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">Curadoria Nexo</h2>
              <p className="text-sm leading-relaxed text-slate-600">
                Canal exclusivo para o Nexo conduzir entrevista guiada com usuários habilitados
                quando houver decisões ou padrões que precisam ser curados antes de virar
                conhecimento operacional.
              </p>
            </div>
          </div>
          <Button
            onClick={() => iniciarCuradoria()}
            className="shrink-0 bg-violet-600 text-white hover:bg-violet-700"
          >
            <MessageSquareText className="mr-2 h-4 w-4" aria-hidden="true" />
            Iniciar curadoria
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-slate-900">
              <Bot className="h-4 w-4 text-violet-600" aria-hidden="true" />
              Pendências do Nexo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-950">
              {loading ? '...' : resumo.pendencias}
            </p>
            <p className="mt-1 text-xs text-slate-500">Itens aguardando curadoria humana.</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-slate-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Governança
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold text-slate-800">
              Entrevistas para alinhamento de processos comerciais
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              O Nexo organiza perguntas e respostas para apoiar decisões comerciais.
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-slate-900">
              <CheckCircle2 className="h-4 w-4 text-blue-600" aria-hidden="true" />
              Canal guiado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold text-slate-800">
              Espaço para ajuda aberta em decisões estratégicas e operacionais
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              O Nexo conduz o diálogo e registra os pontos necessários para a próxima decisão.
            </p>
          </CardContent>
        </Card>
      </div>

      {erro && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Curadoria indisponível</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-slate-950">Aguardando curadoria</CardTitle>
          <CardDescription>
            Sinais gerados pelo uso do Ajuda do Nexo que precisam ser analisados antes de virar
            regra ou playbook.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Carregando pendências...</p>
          ) : resumo.itens.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              Não há pendências de curadoria neste momento.
            </p>
          ) : (
            <div className="space-y-3">
              {resumo.itens.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/80 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">{resumoEvento(item)}</p>
                      <p className="text-xs text-slate-500">Recebido em {dataCurta(item.created_at || item.created)}</p>
                    </div>
                    <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-700">
                      Revisão obrigatória
                    </Badge>
                  </div>
                  {item.contexto_resumo && (
                    <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">
                      {item.contexto_resumo}
                    </p>
                  )}
                  <div className="mt-3">
                    <Button variant="outline" size="sm" onClick={() => iniciarCuradoria(item)}>
                      Entrevistar sobre esta pendência
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {entrevistaAberta && (
        <Card className="rounded-xl border-violet-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-slate-950">Entrevista guiada do Nexo</CardTitle>
            <CardDescription>
              Primeira versão do canal. O próximo passo será conectar esta conversa às pendências
              selecionadas e salvar respostas estruturadas para revisão.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendenciaSelecionada && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Pendência selecionada
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {resumoEvento(pendenciaSelecionada)}
                </p>
              </div>
            )}
            {etapaEntrevista === 0 ? (
              <>
                <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm leading-relaxed text-slate-700">
                  <p className="font-semibold text-slate-900">Nexo</p>
                  <p className="mt-1">
                    Vou conduzir perguntas objetivas sobre um padrão identificado no App Comercial.
                    Responda de forma curta, validando regra, exceção e responsável pela decisão.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => setEtapaEntrevista(1)}
                    disabled={!pendenciaSelecionada}
                    className="bg-violet-600 text-white hover:bg-violet-700"
                  >
                    Começar entrevista
                  </Button>
                  <Button variant="outline" onClick={fecharEntrevista}>
                    Fechar
                  </Button>
                </div>
              </>
            ) : etapaEntrevista <= perguntasEntrevista.length ? (
              <>
                <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm leading-relaxed text-slate-700">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                    Pergunta {etapaEntrevista} de {perguntasEntrevista.length}
                  </p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {perguntasEntrevista[etapaEntrevista - 1]}
                  </p>
                </div>
                <label className="block space-y-2 text-sm font-medium text-slate-700">
                  Resposta curta para curadoria
                  <textarea
                    value={respostasEntrevista[etapaEntrevista - 1] || ''}
                    onChange={(event) => atualizarRespostaEntrevista(event.target.value)}
                    className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none ring-violet-200 focus:ring-2"
                    placeholder="Digite a orientação, regra ou observação validada."
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={avancarEntrevista}
                    disabled={salvandoEntrevista}
                    className="bg-violet-600 text-white hover:bg-violet-700"
                  >
                    {salvandoEntrevista
                      ? 'Enviando...'
                      : etapaEntrevista === perguntasEntrevista.length
                        ? 'Enviar para revisão'
                        : 'Próxima pergunta'}
                  </Button>
                  <Button variant="outline" onClick={fecharEntrevista}>
                    Fechar
                  </Button>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900">
                {entrevistaSalva ? 'Entrevista enviada para revisão.' : 'Entrevista registrada para revisão.'} As respostas serão tratadas antes de virar regra
                ou playbook comercial.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
