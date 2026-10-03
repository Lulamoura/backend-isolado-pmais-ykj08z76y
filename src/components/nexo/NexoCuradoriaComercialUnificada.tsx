import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  type AcaoCasoCuradoriaComercial,
  type CasoCuradoriaComercial,
  type CuradoriaComercialResponse,
  listarCasosCuradoriaComercial,
  transicionarCasoCuradoriaComercial,
} from '@/services/nexo-curadoria'

const perguntasEntrevista = [
  'Qual orientação comercial deve valer para situações como esta?',
  'Quais exceções precisam ser consideradas?',
  'O que deve ser registrado e quem é responsável pelo próximo passo?',
  'Esta orientação pode ser encaminhada para decisão? Registre a justificativa.',
]

const visoes = [
  { chave: 'para_tratar', rotulo: 'Para tratar' },
  { chave: 'aguardando_decisao', rotulo: 'Aguardando decisão' },
  { chave: 'conhecimento_aprovado', rotulo: 'Conhecimento aprovado' },
  { chave: 'historico', rotulo: 'Histórico' },
] as const

type Visao = (typeof visoes)[number]['chave']

const vazio: CuradoriaComercialResponse = {
  ok: true,
  visoes: {
    para_tratar: [],
    aguardando_decisao: [],
    conhecimento_aprovado: [],
    historico: [],
  },
  contadores: {
    para_tratar: 0,
    aguardando_decisao: 0,
    conhecimento_aprovado: 0,
    historico: 0,
  },
  guardrails: {
    sem_payload_bruto: true,
    sem_ids_tecnicos_visiveis: true,
    automatic_send_allowed: false,
  },
}

const fonteRotulos: Record<string, string> = {
  whatsapp_uazapi: 'WhatsApp',
  whatsapp: 'WhatsApp',
  nexo_app: 'App Comercial',
  atividade_comercial: 'App Comercial',
  activecampaign: 'ActiveCampaign',
  proposta: 'Proposta',
  reuniao: 'Reunião',
  reuniao_externa: 'Reunião',
  followup: 'Follow-up',
}

const statusRotulos: Record<string, string> = {
  aberto_curadoria: 'Aguardando revisão',
  em_entrevista: 'Revisão em andamento',
  aguardando_gestao: 'Aguardando gestão comercial',
  aguardando_direcao: 'Aguardando direção',
  aprovado: 'Aprovado para uso operacional',
  rejeitado: 'Não aprovado',
  retirado: 'Retirado de uso',
  sem_acao: 'Encerrado sem alteração',
}

const conhecimentoStatusRotulos: Record<string, string> = {
  pendente_publicacao: 'Publicação pendente',
  ativo: 'Orientação vigente',
  pendente_retirada: 'Retirada pendente',
  retirado: 'Orientação retirada',
}

function dataRecife(valor?: string | null) {
  if (!valor) return 'Data não informada'
  const data = new Date(valor.replace(' ', 'T'))
  if (Number.isNaN(data.getTime())) return 'Data não informada'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Recife',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data)
}

function rotuloFonte(fonte: string) {
  return fonteRotulos[fonte] || 'Contexto comercial'
}

function referenciaHumana(caso: CasoCuradoriaComercial) {
  return [
    caso.empresa_nome,
    caso.contato_nome,
    caso.negocio_numero ? `Negócio ${caso.negocio_numero}` : null,
    caso.negocio_titulo,
  ].filter(Boolean)
}

function CasoCard({
  caso,
  visao,
  ocupado,
  somenteLeitura,
  onEntrevistar,
  onTransicionar,
}: {
  caso: CasoCuradoriaComercial
  visao: Visao
  ocupado: boolean
  somenteLeitura: boolean
  onEntrevistar: (caso: CasoCuradoriaComercial) => void
  onTransicionar: (
    caso: CasoCuradoriaComercial,
    acao: AcaoCasoCuradoriaComercial,
    observacao: string,
  ) => void
}) {
  const fontes = Array.from(new Set([caso.fonte_principal, ...(caso.fontes || [])])).filter(Boolean)
  const referencias = referenciaHumana(caso)

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {fontes.map((fonte) => (
              <Badge key={fonte} variant="outline" className="bg-slate-50 text-slate-700">
                {rotuloFonte(fonte)}
              </Badge>
            ))}
            {caso.alcada === 'direcao' && (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                Decisão da direção
              </Badge>
            )}
          </div>
          <h3 className="mt-3 text-base font-bold text-slate-900">{caso.titulo}</h3>
          {referencias.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-slate-600">
              {referencias.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          )}
          {caso.responsavel_nome && (
            <p className="mt-1 text-xs text-slate-500">Responsável: {caso.responsavel_nome}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-800">
            {statusRotulos[caso.status] || 'Em análise'}
          </Badge>
          {conhecimentoStatusRotulos[caso.conhecimento_status] && (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
              {conhecimentoStatusRotulos[caso.conhecimento_status]}
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Evidência consolidada
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{caso.resumo_factual}</p>
        </div>
        <div className="rounded-lg bg-violet-50/60 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">
            Motivo da curadoria
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{caso.motivo_curadoria}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>{caso.evidencia_contagem} evidência(s) consolidada(s)</span>
        <span>{caso.recorrencia_contagem} caso(s) independente(s)</span>
        <span>Atualizado em {dataRecife(caso.last_seen_at)}</span>
      </div>

      {caso.regra_candidata && (
        <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
            Orientação proposta
          </p>
          <p className="mt-1 text-sm font-medium leading-relaxed text-slate-800">
            {caso.regra_candidata}
          </p>
        </div>
      )}

      {!somenteLeitura && (
        <div className="mt-4 flex flex-wrap gap-2">
          {visao === 'para_tratar' && (
            <Button size="sm" onClick={() => onEntrevistar(caso)} disabled={ocupado}>
              {caso.status === 'em_entrevista' ? 'Continuar revisão' : 'Iniciar revisão'}
            </Button>
          )}
          {visao === 'aguardando_decisao' && (
            <>
              <Button
                size="sm"
                onClick={() => onTransicionar(caso, 'aprovar', 'Aprovada após revisão humana.')}
                disabled={ocupado || !caso.regra_candidata}
              >
                Aprovar orientação
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEntrevistar(caso)}
                disabled={ocupado}
              >
                Ajustar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-rose-200 text-rose-700 hover:bg-rose-50"
                onClick={() =>
                  onTransicionar(caso, 'rejeitar', 'Não aprovada após revisão humana.')
                }
                disabled={ocupado}
              >
                Rejeitar
              </Button>
            </>
          )}
          {visao === 'conhecimento_aprovado' && (
            <Button
              size="sm"
              variant="outline"
              className="border-rose-200 text-rose-700 hover:bg-rose-50"
              onClick={() =>
                onTransicionar(caso, 'retirar', 'Orientação retirada de uso após revisão humana.')
              }
              disabled={ocupado}
            >
              Retirar orientação
            </Button>
          )}
          {visao === 'historico' && caso.reabertura_elegivel && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onTransicionar(caso, 'reabrir', 'Caso reaberto para nova análise.')}
              disabled={ocupado}
            >
              Reabrir análise
            </Button>
          )}
        </div>
      )}
    </article>
  )
}

export default function NexoCuradoriaComercialUnificada({
  somenteLeitura = false,
}: {
  somenteLeitura?: boolean
}) {
  const [dados, setDados] = useState<CuradoriaComercialResponse>(vazio)
  const [visao, setVisao] = useState<Visao>('para_tratar')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [casoEntrevista, setCasoEntrevista] = useState<CasoCuradoriaComercial | null>(null)
  const [etapa, setEtapa] = useState(1)
  const [respostas, setRespostas] = useState<string[]>([])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      setDados(await listarCasosCuradoriaComercial(50))
    } catch (_) {
      setErro(
        'A Curadoria Comercial está temporariamente indisponível. Nenhuma ausência de casos foi presumida.',
      )
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const itens = useMemo(() => dados.visoes[visao] || [], [dados, visao])

  function abrirEntrevista(caso: CasoCuradoriaComercial) {
    if (somenteLeitura) return
    const anteriores = [...(caso.entrevista_respostas || [])]
    setCasoEntrevista(caso)
    setRespostas(anteriores)
    setEtapa(Math.max(1, Math.min(perguntasEntrevista.length, caso.entrevista_etapa || 1)))
  }

  function fecharEntrevista() {
    if (ocupado) return
    setCasoEntrevista(null)
    setRespostas([])
    setEtapa(1)
  }

  function atualizarResposta(valor: string) {
    setRespostas((atuais) => {
      const copia = [...atuais]
      copia[etapa - 1] = valor
      return copia
    })
  }

  async function executarTransicao(
    caso: CasoCuradoriaComercial,
    acao: AcaoCasoCuradoriaComercial,
    observacao: string,
  ) {
    if (somenteLeitura) return
    setOcupado(true)
    try {
      await transicionarCasoCuradoriaComercial(caso.id, {
        acao,
        expected_revision: caso.revisao,
        regra_candidata: caso.regra_candidata || '',
        decisao_observacao: observacao,
      })
      toast.success('Curadoria atualizada.')
      await carregar()
    } catch (error: any) {
      if (error?.status === 409 || error?.message?.includes('REVISAO_DESATUALIZADA')) {
        toast.error('Este caso mudou durante a revisão. A fila foi atualizada.')
        await carregar()
      } else {
        toast.error('Não foi possível registrar a decisão agora.')
      }
    } finally {
      setOcupado(false)
    }
  }

  async function salvarRascunho() {
    if (!casoEntrevista || somenteLeitura) return
    const respostasAteEtapa = respostas.slice(0, etapa)
    setOcupado(true)
    try {
      await transicionarCasoCuradoriaComercial(casoEntrevista.id, {
        acao: 'salvar_rascunho',
        expected_revision: casoEntrevista.revisao,
        entrevista_etapa: etapa,
        entrevista_respostas: respostasAteEtapa,
        regra_candidata: respostasAteEtapa[0] || casoEntrevista.regra_candidata || '',
      })
      toast.success('Rascunho salvo para continuar depois.')
      fecharEntrevista()
      await carregar()
    } catch (_) {
      toast.error('Não foi possível salvar o rascunho agora.')
    } finally {
      setOcupado(false)
    }
  }

  async function encaminharEntrevista() {
    if (!casoEntrevista || somenteLeitura) return
    const respostasCompletas = respostas.slice(0, perguntasEntrevista.length)
    if (respostasCompletas.some((resposta) => !String(resposta || '').trim())) {
      toast.error('Responda as quatro etapas antes de encaminhar.')
      return
    }
    const acao: AcaoCasoCuradoriaComercial =
      casoEntrevista.alcada === 'direcao' ? 'encaminhar_direcao' : 'encaminhar_gestao'
    setOcupado(true)
    try {
      await transicionarCasoCuradoriaComercial(casoEntrevista.id, {
        acao,
        expected_revision: casoEntrevista.revisao,
        entrevista_etapa: perguntasEntrevista.length,
        entrevista_respostas: respostasCompletas,
        regra_candidata: respostasCompletas[0],
        decisao_observacao: respostasCompletas[3],
      })
      toast.success('Caso encaminhado para decisão humana.')
      fecharEntrevista()
      await carregar()
    } catch (_) {
      toast.error('Não foi possível encaminhar o caso agora.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="space-y-4" aria-label="Curadoria Comercial Unificada">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Contexto comercial consolidado
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-xl font-bold text-slate-900">
              <BookOpenCheck className="h-5 w-5 text-violet-700" aria-hidden="true" />
              Curadoria Comercial
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
              O Nexo elimina duplicidades e reúne evidências de WhatsApp, negócios, propostas,
              follow-ups, reuniões e ActiveCampaign. Assuntos comuns só entram após três casos
              independentes; matérias sensíveis seguem imediatamente para decisão. Nenhuma evidência
              vira orientação oficial sem revisão humana.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={carregando}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Visões da curadoria">
          {visoes.map((item) => (
            <button
              key={item.chave}
              type="button"
              role="tab"
              aria-selected={visao === item.chave}
              onClick={() => setVisao(item.chave)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                visao === item.chave
                  ? 'border-violet-700 bg-violet-700 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {item.rotulo} ({dados.contadores[item.chave]})
            </button>
          ))}
        </div>
      </div>

      {somenteLeitura && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <p className="font-semibold">Modo somente leitura</p>
          <p className="mt-1 text-xs">
            Este perfil pode consultar a curadoria, mas não pode iniciar revisões nem registrar
            decisões.
          </p>
        </div>
      )}

      {erro && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{erro}</p>
        </div>
      )}

      {!erro && carregando ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Carregando casos da curadoria...
        </div>
      ) : !erro && itens.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-slate-800">Nenhum caso nesta visão</p>
          <p className="mt-1 text-xs text-slate-500">
            A fila será atualizada quando houver evidência comercial consolidada para este estágio.
          </p>
        </div>
      ) : (
        !erro && (
          <div className="space-y-3">
            {itens.map((caso) => (
              <CasoCard
                key={caso.id}
                caso={caso}
                visao={visao}
                ocupado={ocupado}
                somenteLeitura={somenteLeitura}
                onEntrevistar={abrirEntrevista}
                onTransicionar={(item, acao, observacao) =>
                  void executarTransicao(item, acao, observacao)
                }
              />
            ))}
          </div>
        )
      )}

      {!somenteLeitura && casoEntrevista && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="curadoria-entrevista-titulo"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
                  Etapa {etapa} de {perguntasEntrevista.length}
                </p>
                <h2
                  id="curadoria-entrevista-titulo"
                  className="mt-1 text-xl font-bold text-slate-900"
                >
                  Entrevista guiada
                </h2>
                <p className="mt-1 text-sm text-slate-600">{casoEntrevista.titulo}</p>
              </div>
              <button
                type="button"
                aria-label="Fechar entrevista"
                onClick={fecharEntrevista}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-violet-100 bg-violet-50/60 p-4">
              <div className="flex items-center gap-2 text-violet-800">
                <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                <p className="text-sm font-bold">{perguntasEntrevista[etapa - 1]}</p>
              </div>
              <label className="mt-3 block text-xs font-semibold text-slate-700">
                Resposta da etapa atual
                <textarea
                  value={respostas[etapa - 1] || ''}
                  onChange={(event) => atualizarResposta(event.target.value)}
                  className="mt-1.5 min-h-28 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm font-normal text-slate-800 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                  placeholder="Registre a orientação de forma objetiva."
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEtapa((atual) => Math.max(1, atual - 1))}
                  disabled={etapa === 1 || ocupado}
                >
                  Anterior
                </Button>
                {etapa < perguntasEntrevista.length && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      setEtapa((atual) => Math.min(perguntasEntrevista.length, atual + 1))
                    }
                    disabled={!String(respostas[etapa - 1] || '').trim() || ocupado}
                  >
                    Próxima etapa
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void salvarRascunho()}
                  disabled={ocupado}
                >
                  <Clock3 className="mr-1.5 h-4 w-4" />
                  Salvar e continuar depois
                </Button>
                {etapa === perguntasEntrevista.length && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void encaminharEntrevista()}
                    disabled={ocupado}
                  >
                    <ShieldCheck className="mr-1.5 h-4 w-4" />
                    Encaminhar para decisão
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
