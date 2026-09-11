import { useState } from 'react'
import { Bot, ClipboardList, FileText, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
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

function FonteBadge({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <Badge variant={active ? 'secondary' : 'outline'} className="text-xs">
      {children}: {active ? 'ok' : 'pendente'}
    </Badge>
  )
}

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
  const notas = contexto?.notas_followups || []

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
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando contexto consolidado…
            </p>
          ) : !contexto ? (
            <p className="text-sm text-muted-foreground">Contexto ainda não carregado.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <FonteBadge active={contexto.fontes?.negocio_local}>App</FonteBadge>
                <FonteBadge active={contexto.fontes?.activecampaign_deal}>CRM</FonteBadge>
                <FonteBadge active={contexto.fontes?.activecampaign_campos}>Campos CRM</FonteBadge>
                <FonteBadge active={contexto.fontes?.activecampaign_notas}>Follow-ups</FonteBadge>
                <FonteBadge active={contexto.fontes?.proposta_aplicativo}>Proposta</FonteBadge>
              </div>

              {modal === 'ajuda' && (
                <section className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="h-4 w-4" /> Sem envio automático
                  </div>
                  <p className="mt-2">
                    Use este contexto para orientar follow-up, negociação, objeções, roteiro de
                    ligação e próximo passo. O Nexo recomenda; o operador decide e registra a ação.
                  </p>
                </section>
              )}

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

              <section className="rounded-md border p-3 text-sm">
                <p className="font-semibold text-slate-950">Notas/follow-ups do CRM</p>
                {notas.length ? (
                  <ul className="mt-2 list-disc space-y-2 pl-5 text-slate-700">
                    {notas.slice(0, 5).map((nota, index) => (
                      <li key={nota.id || index}>{notaTexto(nota)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-muted-foreground">Nenhum follow-up encontrado.</p>
                )}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
