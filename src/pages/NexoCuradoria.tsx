import { useEffect, useState } from 'react'
import { AlertCircle, Bot, CheckCircle2, MessageSquareText, ShieldCheck } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  obterResumoCuradoriaNexo,
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
  const negocio = evento.external_id ? `Negócio ${evento.external_id}` : 'Negócio não identificado'
  return `${negocio} · ${acao}`
}

export default function NexoCuradoria() {
  const [resumo, setResumo] = useState<NexoCuradoriaResumo>({ pendencias: 0, itens: [] })
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [entrevistaAberta, setEntrevistaAberta] = useState(false)

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
              Curadoria do segundo cérebro
            </Badge>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">Curadoria Nexo</h2>
              <p className="text-sm leading-relaxed text-slate-600">
                Canal exclusivo para o Nexo conduzir entrevista guiada com usuários habilitados
                quando houver decisões ou padrões que precisam ser curados antes de virar
                conhecimento operacional.
              </p>
              <p className="text-sm font-medium text-slate-700">
                Este canal não grava direto no segundo cérebro. Ele organiza evidências, respostas
                curtas e propostas para revisão governada.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setEntrevistaAberta(true)}
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
            <p className="text-sm font-semibold text-slate-800">Sem promoção automática</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              O Nexo entrevista, consolida e propõe. A promoção segue revisão e versionamento.
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
            <p className="text-sm font-semibold text-slate-800">Perguntas curtas e objetivas</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Evita canal esquecido e evita conversa livre sem padrão de decisão.
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
                      <p className="text-xs text-slate-500">
                        Recebido em {dataCurta(item.created_at || item.created)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="rounded-full border-amber-200 bg-amber-50 text-amber-700"
                    >
                      Revisão obrigatória
                    </Badge>
                  </div>
                  {item.contexto_resumo && (
                    <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">
                      {item.contexto_resumo}
                    </p>
                  )}
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
            <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm leading-relaxed text-slate-700">
              <p className="font-semibold text-slate-900">Nexo</p>
              <p className="mt-1">
                Vou conduzir perguntas objetivas sobre um padrão identificado no App Comercial.
                Responda de forma curta, validando regra, exceção e responsável pela decisão.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="bg-violet-600 text-white hover:bg-violet-700">
                Começar entrevista
              </Button>
              <Button variant="outline" onClick={() => setEntrevistaAberta(false)}>
                Fechar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
