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
    descricao: 'Diagnóstico, riscos, perguntas críticas e próximo contato recomendado.',
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

function ListaResposta({ titulo, itens }: { titulo: string; itens?: string[] }) {
  return (
    <section className="rounded-md border p-3 text-sm">
      <p className="font-semibold text-slate-950">{titulo}</p>
      {itens?.length ? (
        <ul className="mt-2 list-disc space-y-2 pl-5 text-slate-700">
          {itens.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-muted-foreground">Sem apontamentos para este item.</p>
      )}
    </section>
  )
}

function notaTexto(nota: NonNullable<NexoContextoNegocio['notas_followups']>[number]) {
  return nota.texto || nota.conteudo || nota.note || 'Nota sem conteúdo textual.'
}

function resumoUltimoFollowUp(contexto: NexoContextoNegocio) {
  const notas = contexto.notas_followups || []
  if (!notas.length) return 'Nenhum follow-up registrado no contexto do Nexo.'
  const ultimo = notaTexto(notas[0])
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
            <DialogDescription>
              {businessTitle} {externalIdLimpo ? `· negócio AC #${externalIdLimpo}` : ''}
            </DialogDescription>
          </DialogHeader>

          {!canLoad ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Este card ainda não tem ID externo do ActiveCampaign para consultar o contexto do
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
                <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                  <section className="rounded-md border bg-white p-3 text-sm">
                    <p className="font-semibold text-slate-950">Diagnóstico comercial</p>
                    <p className="mt-2 whitespace-pre-wrap text-slate-700">{ajuda.diagnostico}</p>
                  </section>
                  <ListaResposta titulo="Perguntas críticas" itens={ajuda.perguntas_criticas} />
                  <ListaResposta titulo="Riscos percebidos" itens={ajuda.riscos} />
                  <ListaResposta titulo="Próximos passos sugeridos" itens={ajuda.proximos_passos} />
                  {ajuda.mensagem_sugerida && (
                    <section className="rounded-md border bg-white p-3 text-sm">
                      <p className="font-semibold text-slate-950">Mensagem sugerida para revisão</p>
                      <p className="mt-2 whitespace-pre-wrap text-slate-700">
                        {ajuda.mensagem_sugerida}
                      </p>
                    </section>
                  )}
                  <ListaResposta
                    titulo="Dicas para melhorar notas"
                    itens={ajuda.dicas_para_melhorar_notas}
                  />
                  <p className="text-xs text-muted-foreground">
                    {ajuda.aviso ||
                      'Sugestão gerada para revisão humana. Nenhuma mensagem foi enviada.'}
                  </p>
                </div>
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
                      <dt className="text-xs text-muted-foreground">Identificador</dt>
                      <dd>{proposta.identificador || proposta.id || 'Não informado'}</dd>
                    </div>
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
