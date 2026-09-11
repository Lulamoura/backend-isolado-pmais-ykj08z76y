import { useMemo, useState } from 'react'
import { Bot, ClipboardList, FileText, Loader2, MessageSquareText, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { obterContextoNexoNegocio, type NexoContextoNegocio } from '@/services/nexo'

interface NexoBusinessActionsProps {
  externalId: string | null | undefined
  businessTitle: string
  allowNexoHelp: boolean
}

type ModalNexo = 'ajuda' | 'detalhamento' | null

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

function notaTexto(nota: NonNullable<NexoContextoNegocio['notas_followups']>[number]) {
  return nota.texto || nota.conteudo || nota.note || 'Nota sem conteúdo textual.'
}

function contemAlguma(texto: string, termos: string[]) {
  const normalizado = texto.toLocaleLowerCase('pt-BR')
  return termos.some((termo) => normalizado.includes(termo))
}

function gerarAjudaComercial(contexto: NexoContextoNegocio) {
  const campos = contexto.campos_crm || {}
  const notas = contexto.notas_followups || []
  const textosNotas = notas.map(notaTexto).join(' ')
  const base = [
    campos.detalhamento_proposta,
    campos.descricao_negocio,
    campos.tipo_servico,
    textosNotas,
  ]
    .filter(Boolean)
    .join(' ')

  const perguntas: string[] = []
  const proximosPassos: string[] = []
  const dicasNotas: string[] = []

  if (contemAlguma(base, ['análise do rh', 'analise do rh', 'gestora de rh', 'rh'])) {
    perguntas.push(
      'Se o cliente informou que vai aguardar análise do RH, ele deu prazo ou data para essa análise?',
    )
    perguntas.push('A próxima ação cadastrada está alinhada com o prazo que o cliente forneceu?')
    proximosPassos.push(
      'Confirmar com o contato qual é a data esperada de retorno da análise interna do RH.',
    )
    dicasNotas.push(
      'Registrar a pessoa responsável pela análise no cliente, o prazo informado e o motivo da espera.',
    )
  }

  if (contexto.negocio?.proxima_acao_em) {
    perguntas.push(
      'O intervalo até a próxima ação está adequado para o valor e a temperatura do negócio?',
    )
    proximosPassos.push(
      'Se o prazo estiver longo, considerar um contato intermediário curto para manter o negócio aquecido.',
    )
  } else {
    perguntas.push(
      'Este negócio está sem próxima ação registrada. Qual deve ser o próximo contato objetivo?',
    )
    proximosPassos.push('Registrar uma próxima ação com data, canal e objetivo comercial claro.')
  }

  if (notas.length === 0) {
    perguntas.push('Não há follow-ups registrados. O histórico comercial real está fora do CRM?')
    dicasNotas.push(
      'Adicionar uma nota com último contato, resposta do cliente, pendência, responsável e próximo passo.',
    )
  } else {
    dicasNotas.push(
      'Evitar notas genéricas. Preferir: contato feito, quem respondeu, objeção ou pendência, prazo citado e ação combinada.',
    )
  }

  if (!String(campos.detalhamento_proposta || '').trim()) {
    perguntas.push(
      'O Detalhamento da Proposta está vazio. Quais premissas justificam escopo, quantidade, escala e unidades?',
    )
    dicasNotas.push(
      'Completar o detalhamento com premissas comerciais: unidades, quantidade, escala, prioridade, restrições e critério de decisão.',
    )
  }

  if (contexto.proposta) {
    proximosPassos.push(
      'Fazer o follow-up conectando o escopo proposto à dor registrada, não apenas perguntando se a proposta foi aprovada.',
    )
  }

  if (!perguntas.length)
    perguntas.push(
      'Revisar se existe objeção, prazo de decisão, decisor envolvido e próximo passo confirmado.',
    )
  if (!proximosPassos.length)
    proximosPassos.push(
      'Definir a melhor próxima ação com base no histórico e registrar o resultado no CRM.',
    )
  if (!dicasNotas.length)
    dicasNotas.push(
      'Registrar notas com contexto suficiente para que outro comercial entenda a situação sem perguntar novamente.',
    )

  return { perguntas, proximosPassos, dicasNotas }
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

  const externalIdLimpo = String(externalId || '').trim()
  const canLoad = Boolean(externalIdLimpo)

  const abrir = async (modo: Exclude<ModalNexo, null>) => {
    setModal(modo)
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

  const campos = contexto?.campos_crm || {}
  const proposta = contexto?.proposta
  const versao = proposta?.versao_mais_recente
  const ajuda = useMemo(() => (contexto ? gerarAjudaComercial(contexto) : null), [contexto])

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
          ) : modal === 'ajuda' && ajuda ? (
            <div className="space-y-4">
              <section className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4" /> Sem envio automático
                </div>
                <p className="mt-2">
                  O Nexo usa o contexto do negócio para orientar a decisão comercial. O operador
                  revisa, decide e registra a ação no fluxo oficial.
                </p>
              </section>

              <section className="rounded-md border p-3 text-sm">
                <p className="flex items-center gap-2 font-semibold text-slate-950">
                  <Bot className="h-4 w-4" /> Leitura comercial do Nexo
                </p>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-slate-700">
                  {ajuda.perguntas.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section className="rounded-md border p-3 text-sm">
                <p className="font-semibold text-slate-950">Próximos passos sugeridos</p>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-slate-700">
                  {ajuda.proximosPassos.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section className="rounded-md border p-3 text-sm">
                <p className="flex items-center gap-2 font-semibold text-slate-950">
                  <MessageSquareText className="h-4 w-4" /> Dicas para melhorar notas
                </p>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-slate-700">
                  {ajuda.dicasNotas.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section className="rounded-md border bg-slate-50 p-3 text-sm">
                <p className="font-semibold text-slate-950">Resumo do histórico usado</p>
                <p className="mt-2 text-slate-700">{resumoUltimoFollowUp(contexto)}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  O histórico completo continua no botão Notas. Aqui o Nexo usa as notas apenas como
                  base para orientar o follow-up.
                </p>
              </section>
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
