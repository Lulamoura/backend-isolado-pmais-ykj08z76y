import { useState } from 'react'
import { Bot, ClipboardList, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  gerarAjudaNexoNegocio,
  obterContextoNexoNegocio,
  registrarFeedbackAjudaNexo,
  type NexoAcaoAssistida,
  type NexoAjudaComercial,
  type NexoContextoNegocio,
} from '@/services/nexo'

interface NexoBusinessActionsProps {
  externalId: string | null | undefined
  businessTitle: string
  allowNexoHelp: boolean
}

type ModalNexo = 'ajuda' | 'detalhamento' | null

const ACOES_NEXO: Array<{ id: NexoAcaoAssistida; label: string; descricao: string }> = [
  {
    id: 'proximo_follow_up',
    label: 'Sugerir próximo follow-up',
    descricao: 'Uma leitura breve e uma sugestão objetiva para o próximo contato.',
  },
  {
    id: 'preparar_whatsapp',
    label: 'Preparar WhatsApp',
    descricao: 'Mensagem curta para o comercial revisar, copiar e adaptar.',
  },
  {
    id: 'roteiro_ligacao',
    label: 'Gerar roteiro de ligação',
    descricao: 'Abertura, perguntas, pontos de atenção e fechamento com próxima ação.',
  },
  {
    id: 'avaliar_risco_perda',
    label: 'Avaliar risco de perda',
    descricao: 'Sinais de esfriamento, pendências, decisores e urgência de ação.',
  },
  {
    id: 'melhorar_notas',
    label: 'Dicas para melhorar notas',
    descricao: 'O que falta registrar para o Nexo ajudar melhor no próximo contato.',
  },
]

const resumoTexto = (valor?: string | null) => {
  const texto = String(valor || '').trim()
  return texto || 'Não informado.'
}

const formatMoney = (centavos?: number | null) =>
  typeof centavos === 'number'
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100)
    : 'Valor não informado'

const formatDate = (valor?: string | null) =>
  valor
    ? new Date(valor).toLocaleDateString('pt-BR', { timeZone: 'America/Recife' })
    : 'Data não informada'

function CampoTexto({ titulo, texto }: { titulo: string; texto?: string | null }) {
  return (
    <section className="rounded-md border bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{resumoTexto(texto)}</p>
    </section>
  )
}

function AjudaResposta({
  ajuda,
  contexto,
}: {
  ajuda: NexoAjudaComercial
  contexto: NexoContextoNegocio
}) {
  const auditoria = ajuda.auditoria_geracao
  const feedbackDisponivel = auditoria?.registro_confirmado === true
  const fallback = Boolean(auditoria?.fallback ?? ajuda.fallback)
  const analiseWhatsapp = ajuda.analise_whatsapp || {}
  const minutaInicial = analiseWhatsapp.rascunho_follow_up || ajuda.mensagem_sugerida || ''
  const [minuta, setMinuta] = useState(minutaInicial)
  const [registrando, setRegistrando] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const contextoFactual = [resumoUltimoFollowUp(contexto)]
  const sugestao =
    analiseWhatsapp.proximo_passo_recomendado || ajuda.proximos_passos?.[0] || ajuda.mensagem_sugerida

  const registrarFeedback = async (resultado: 'usada' | 'ajustada' | 'nao_foi_util') => {
    const auditId = String(auditoria?.audit_id || '').trim()
    if (!auditId) {
      toast.error('A sugestão não possui identificação de auditoria para registrar a avaliação.')
      return
    }
    setRegistrando(true)
    try {
      await registrarFeedbackAjudaNexo(ajuda.external_id, {
        audit_id: auditId,
        resultado,
      })
      setFeedback(resultado)
      toast.success('Avaliação registrada para melhorar as próximas sugestões do Nexo.')
    } catch (_) {
      toast.error('Não foi possível registrar a avaliação desta sugestão.')
    } finally {
      setRegistrando(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
      <p className="font-semibold text-slate-950">Resposta do Nexo</p>
      <section className="rounded-md border bg-white p-4 text-sm">
        <p className="font-semibold text-slate-950">Contexto considerado</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-800">
          {contextoFactual.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section className="rounded-md border bg-white p-4 text-sm">
        <p className="font-semibold text-slate-950">Leitura do Nexo</p>
        <p className="mt-2 whitespace-pre-wrap text-slate-800">{resumoTexto(ajuda.diagnostico)}</p>
      </section>
      <section className="rounded-md border bg-white p-4 text-sm">
        <p className="font-semibold text-slate-950">Sugestão de ação</p>
        <p className="mt-2 whitespace-pre-wrap text-slate-800">{resumoTexto(sugestao)}</p>
      </section>
      <section className="rounded-md border bg-white p-4 text-sm">
        <label htmlFor={`nexo-minuta-${ajuda.external_id}`} className="font-semibold text-slate-950">
          Minuta editável
        </label>
        <textarea
          id={`nexo-minuta-${ajuda.external_id}`}
          aria-label="Minuta editável"
          value={minuta}
          onChange={(event) => setMinuta(event.target.value)}
          rows={5}
          className="mt-2 w-full rounded-md border bg-white p-3 leading-6 text-slate-800"
        />
      </section>
      {feedbackDisponivel ? (
        <section className="rounded-md border bg-white p-4 text-sm">
          <p className="font-semibold text-slate-950">Esta sugestão foi útil?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={registrando || Boolean(feedback)} onClick={() => registrarFeedback('usada')}>
              Usar sugestão
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={registrando || Boolean(feedback)} onClick={() => registrarFeedback('ajustada')}>
              Ajustar
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={registrando || Boolean(feedback)} onClick={() => registrarFeedback('nao_foi_util')}>
              Não foi útil
            </Button>
          </div>
          {feedback ? <p className="mt-2 text-xs text-emerald-700">Avaliação registrada.</p> : null}
        </section>
      ) : (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          A sugestão foi exibida, mas sua avaliação está indisponível porque o registro auditável não foi confirmado.
        </p>
      )}
      {fallback ? (
        <p className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white">
          Falha de acionamento de modelo - Avisar administrador do sistema.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {ajuda.aviso || 'Sugestão gerada para revisão humana. Nenhuma mensagem foi enviada.'}
      </p>
    </div>
  )
}

function notaTexto(nota: NonNullable<NexoContextoNegocio['notas_followups']>[number]) {
  return nota.texto || nota.conteudo || nota.note || 'Nota sem conteúdo textual.'
}

function notaTimestamp(nota: NonNullable<NexoContextoNegocio['notas_followups']>[number]) {
  const valor =
    nota.alterada_em || nota.updated || nota.criada_em || nota.created || nota.data || ''
  const timestamp = Date.parse(String(valor))
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function ultimoFollowUp(notas: NonNullable<NexoContextoNegocio['notas_followups']>) {
  return [...notas].sort((a, b) => notaTimestamp(b) - notaTimestamp(a))[0]
}

function resumoUltimoFollowUp(contexto: NexoContextoNegocio) {
  const notas = contexto.notas_followups || []
  if (!notas.length) return 'Nenhum follow-up registrado no contexto do Nexo.'
  const ultimo = notaTexto(ultimoFollowUp(notas))
  return `${notas.length} registro${notas.length > 1 ? 's' : ''} de follow-up. Último registro: ${ultimo}`
}

export function NexoBusinessActions({
  externalId,
  businessTitle,
  allowNexoHelp,
}: NexoBusinessActionsProps) {
  const [modal, setModal] = useState<ModalNexo>(null)
  const [contexto, setContexto] = useState<NexoContextoNegocio | null>(null)
  const [loading, setLoading] = useState(false)
  const [acao, setAcao] = useState<NexoAcaoAssistida>('proximo_follow_up')
  const [instrucao, setInstrucao] = useState('')
  const [gerando, setGerando] = useState(false)
  const [ajuda, setAjuda] = useState<NexoAjudaComercial | null>(null)

  const externalIdLimpo = String(externalId || '').trim()
  const canLoad = Boolean(externalIdLimpo)

  const abrir = async (modo: Exclude<ModalNexo, null>) => {
    setModal(modo)
    setAjuda(null)
    if (!canLoad) return
    setLoading(true)
    try {
      const resposta = await obterContextoNexoNegocio(externalIdLimpo)
      setContexto(resposta)
    } catch (_) {
      toast.error('Não foi possível carregar o contexto do Nexo para este negócio.')
      setContexto(null)
    } finally {
      setLoading(false)
    }
  }

  const gerarAjuda = async () => {
    if (!contexto || !externalIdLimpo) return
    setGerando(true)
    try {
      const resposta = await gerarAjudaNexoNegocio(externalIdLimpo, acao, contexto, instrucao)
      setAjuda(resposta)
    } catch (_) {
      toast.error('Não foi possível gerar a ajuda inteligente do Nexo.')
      setAjuda(null)
    } finally {
      setGerando(false)
    }
  }

  const campos = contexto?.campos_crm || {}
  const proposta = contexto?.proposta
  const versao = proposta?.versao_mais_recente

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {allowNexoHelp && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!canLoad}
            onClick={() => void abrir('ajuda')}
          >
            <Bot className="mr-2 h-4 w-4" />
            Ajuda do Nexo
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canLoad}
          onClick={() => void abrir('detalhamento')}
        >
          <ClipboardList className="mr-2 h-4 w-4" />
          Detalhamento da Proposta
        </Button>
      </div>
      <Dialog open={modal !== null} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modal === 'ajuda' ? 'Ajuda do Nexo' : 'Detalhamento da Proposta'}
            </DialogTitle>
            <DialogDescription>{businessTitle}</DialogDescription>
          </DialogHeader>

          {!canLoad ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Este negócio ainda não está vinculado ao ActiveCampaign para consultar o contexto do
              Nexo.
            </p>
          ) : loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando contexto do negócio…
            </p>
          ) : !contexto ? (
            <p className="text-sm text-muted-foreground">Contexto ainda não carregado.</p>
          ) : modal === 'ajuda' ? (
            <div className="space-y-4">
              <section className="rounded-md border p-3 text-sm">
                <p className="flex items-center gap-2 font-semibold text-slate-950">
                  <Bot className="h-4 w-4" /> Escolha a ajuda do Nexo
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {ACOES_NEXO.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`rounded-md border p-3 text-left transition ${
                        acao === item.id
                          ? 'border-violet-400 bg-violet-50 text-violet-950'
                          : 'bg-white hover:bg-slate-50'
                      }`}
                      onClick={() => setAcao(item.id)}
                    >
                      <span className="block font-medium">{item.label}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {item.descricao}
                      </span>
                    </button>
                  ))}
                </div>
                <label className="mt-3 block text-xs font-medium text-muted-foreground">
                  Orientação opcional para o Nexo
                  <textarea
                    className="mt-1 min-h-20 w-full rounded-md border bg-white p-2 text-sm text-slate-900"
                    placeholder="Ex.: focar em follow-up por WhatsApp, tom mais consultivo, avaliar se o prazo está longo demais."
                    value={instrucao}
                    onChange={(event) => setInstrucao(event.target.value)}
                  />
                </label>
                <Button
                  className="mt-3"
                  type="button"
                  onClick={() => void gerarAjuda()}
                  disabled={gerando}
                >
                  {gerando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Gerar ajuda do Nexo
                </Button>
              </section>

              {ajuda ? (
                <AjudaResposta
                  key={ajuda.auditoria_geracao?.audit_id || ajuda.mensagem_sugerida || 'ajuda-nexo'}
                  ajuda={ajuda}
                  contexto={contexto}
                />
              ) : (
                <section className="rounded-md border bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-slate-950">Resumo do histórico disponível</p>
                  <p className="mt-2 text-slate-700">{resumoUltimoFollowUp(contexto)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    O histórico completo continua no botão Notas. Clique em Gerar ajuda do Nexo para
                    receber uma análise específica deste negócio.
                  </p>
                </section>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <CampoTexto titulo="Tipo de Serviço" texto={campos.tipo_servico} />
                <CampoTexto titulo="Descrição do Negócio" texto={campos.descricao_negocio} />
              </div>
              <CampoTexto titulo="Detalhamento da Proposta" texto={campos.detalhamento_proposta} />

              <section className="rounded-md border p-3 text-sm">
                <p className="font-semibold text-slate-950">Resumo comercial</p>
                <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Empresa</dt>
                    <dd>{contexto.empresa?.nome || 'Não informada'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Contato</dt>
                    <dd>{contexto.contato?.nome || 'Não informado'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Fase</dt>
                    <dd>
                      {contexto.negocio?.fase_crm || contexto.negocio?.etapa || 'Não informada'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Valor</dt>
                    <dd>{formatMoney(contexto.negocio?.valor_centavos)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Próxima ação</dt>
                    <dd>{formatDate(contexto.negocio?.proxima_acao_em)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Fonte</dt>
                    <dd>{contexto.negocio?.fonte_prospeccao || 'Não informada'}</dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-md border p-3 text-sm">
                <p className="flex items-center gap-2 font-semibold text-slate-950">
                  <FileText className="h-4 w-4" /> Proposta no aplicativo
                </p>
                {proposta ? (
                  <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-muted-foreground">Status</dt>
                      <dd>{proposta.status || proposta.publicacao_estado || 'Não informado'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Versão</dt>
                      <dd>{versao?.numero ? `Versão ${versao.numero}` : 'Não informada'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Valor da versão</dt>
                      <dd>{formatMoney(versao?.valor_total_centavos)}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-2 text-muted-foreground">
                    Nenhuma proposta vinculada encontrada.
                  </p>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
