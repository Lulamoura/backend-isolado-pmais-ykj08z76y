import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarClock,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  FileUp,
  History,
  Link2,
  Mail,
  MessageCircle,
  RefreshCw,
  Settings2,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import pb from '@/lib/pocketbase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  listarPropostas,
  criarVersaoPdfProposta,
  configurarIdentificacaoVisitante,
  enviarPropostaPorEmail,
  novaChaveProposta,
  obterTimelineProposta,
  publicarProposta,
  revogarPublicacaoProposta,
  registrarEventoProposta,
  type EventoProposta,
  type ItemProposta,
  type TimelinePropostaInterna,
} from '@/services/propostas'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'
import { devolverQualificacao } from '@/services/qualificacoes'
import { CommercialContextCard } from '@/components/CommercialContextCard'
import { CommercialFilters } from '@/components/CommercialFilters'
import {
  commercialActionCardClass,
  filterAndSortCommercial,
  type CommercialSort,
} from '@/lib/commercial-context'

const reais = (centavos: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100)
const dataHora = (valor: string | null) =>
  valor ? new Date(valor).toLocaleString('pt-BR') : 'Data não informada'
const rotuloEventoPublico: Record<string, string> = {
  pagina_acessada: 'Proposta aberta',
  pdf_visualizado: 'PDF visualizado',
  pdf_baixado: 'PDF baixado',
  proposta_aceita: 'Proposta aceita',
  proposta_recusada: 'Proposta recusada',
}
const rotuloEtapaComercial = (etapa: string) =>
  etapa === 'negociacao' ? 'Proposta em Negociação' : 'Proposta em Produção'
const rotuloDecisao: Record<string, string> = {
  pendente: 'Pendente',
  aceita: 'Aceita',
  recusada: 'Recusada',
}
export default function Propostas() {
  const { isSuperAdmin, perfilSlug } = useIsSuperAdmin()
  const somenteNegociacao = perfilSlug === 'negociacao-propria'
  const somenteLeituraPerfil = perfilSlug === 'leitura-executiva'
  const podeDevolverQualificacao =
    perfilSlug === 'superadministrador' || perfilSlug === 'gestor-comercial'
  const [itens, setItens] = useState<ItemProposta[]>([])
  const [aprovacaoObrigatoria, setAprovacaoObrigatoria] = useState(false)
  const [identificacaoObrigatoria, setIdentificacaoObrigatoria] = useState(true)
  const [identificacaoUpdated, setIdentificacaoUpdated] = useState('')
  const [loading, setLoading] = useState(true)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [busca, setBusca] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [situacaoAcao, setSituacaoAcao] = useState('')
  const [ordenacao, setOrdenacao] = useState<CommercialSort>('proxima_acao')
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFim, setPeriodoFim] = useState('')
  const [motivoDevolucao, setMotivoDevolucao] = useState<Record<string, string>>({})
  const [arquivos, setArquivos] = useState<Record<string, File | null>>({})
  const [timelines, setTimelines] = useState<Record<string, TimelinePropostaInterna>>({})
  const [enviandoPdf, setEnviandoPdf] = useState<string | null>(null)
  const [linksPublicos, setLinksPublicos] = useState<Record<string, string>>({})
  const [destinosEmail, setDestinosEmail] = useState<Record<string, string>>({})
  const [copiasEmail, setCopiasEmail] = useState<Record<string, string>>({})
  const [respostasEmail, setRespostasEmail] = useState<Record<string, string>>({})
  const [assuntosEmail, setAssuntosEmail] = useState<Record<string, string>>({})
  const [mensagensEmail, setMensagensEmail] = useState<Record<string, string>>({})
  const [modalProposta, setModalProposta] = useState<{
    negocioId: string
    modo: 'operacao' | 'historico'
  } | null>(null)
  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const resultado = await listarPropostas()
      setItens(resultado.itens)
      setAprovacaoObrigatoria(resultado.configuracao.aprovacao_interna_obrigatoria)
      setIdentificacaoObrigatoria(resultado.configuracao.identificacao_visitante_obrigatoria)
      setIdentificacaoUpdated(resultado.configuracao.identificacao_visitante_updated)
    } catch (_) {
      toast.error('Não foi possível carregar as propostas.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => void carregar(), [carregar])
  const itensVisiveis = useMemo(
    () =>
      filterAndSortCommercial(
        itens,
        busca,
        responsavel,
        situacaoAcao,
        ordenacao,
        periodoInicio,
        periodoFim,
      ),
    [itens, busca, responsavel, situacaoAcao, ordenacao, periodoInicio, periodoFim],
  )
  const executar = async (item: ItemProposta, tipo: EventoProposta) => {
    const p = item.proposta,
      entrada = valores[item.negocio.id] || ''
    const body: Record<string, unknown> = {
      negocio_id: item.negocio.id,
      tipo,
      updated_esperado: p?.updated ?? item.negocio.updated,
      command_idempotency_key: novaChaveProposta(item.negocio.id, tipo),
      justificativa: `Operação comercial: ${tipo}`,
    }
    if (tipo === 'preparar') {
      body.modalidade = item.contexto.modalidade
      body.valor_total_centavos = item.contexto.valor_centavos
    }
    if (tipo === 'emitir') {
      body.destinatario = entrada
      body.canal_envio = 'email'
    }
    if (tipo === 'decidir') {
      body.decisao = 'aceita'
      body.tipo_evidencia_decisao = 'equivalente_formal'
      body.evidencia_decisao = entrada
    }
    try {
      await registrarEventoProposta(body)
      toast.success('Evento da proposta registrado.')
      await carregar()
    } catch (_) {
      toast.error('A transição não pôde ser registrada.')
    }
  }
  const devolver = async (item: ItemProposta) => {
    const justificativa = motivoDevolucao[item.negocio.id]?.trim()
    if (!justificativa) return
    try {
      await devolverQualificacao(item.negocio.id, item.negocio.updated, justificativa)
      toast.success('Negócio devolvido para Qualificação.')
      await carregar()
    } catch (_) {
      toast.error('O negócio não pôde ser devolvido para Qualificação.')
    }
  }
  const carregarTimeline = async (negocioId: string) => {
    try {
      const timeline = await obterTimelineProposta(negocioId)
      setTimelines((atual) => ({ ...atual, [negocioId]: timeline }))
    } catch (_) {
      toast.error('Não foi possível carregar o histórico de versões.')
    }
  }
  const abrirModal = (negocioId: string, modo: 'operacao' | 'historico') => {
    setModalProposta({ negocioId, modo })
    if (modo === 'historico') void carregarTimeline(negocioId)
  }
  const assuntoPadrao = (item: ItemProposta) =>
    `Proposta comercial PMais — ${item.contexto.empresa.nome || item.negocio.titulo}`
  const mensagemPadrao = (item: ItemProposta) =>
    `Olá,\n\nEncaminhamos a proposta comercial da PMais para ${item.contexto.empresa.nome || 'sua empresa'}.\n\nVocê pode visualizar o documento pelo link abaixo:\n[LINK_PROPOSTA]\n\nPermanecemos à disposição para esclarecimentos e para os próximos passos.\n\nAtenciosamente,\nEquipe Comercial PMais`
  const enviarPdf = async (item: ItemProposta) => {
    const arquivo = arquivos[item.negocio.id]
    if (!arquivo || !item.proposta) return
    setEnviandoPdf(item.negocio.id)
    try {
      await criarVersaoPdfProposta(item.negocio.id, item.proposta.updated, arquivo)
      setArquivos((atual) => ({ ...atual, [item.negocio.id]: null }))
      toast.success('Nova versão privada do PDF criada.')
      await carregar()
      await carregarTimeline(item.negocio.id)
    } catch (_) {
      toast.error('Não foi possível criar a versão do PDF.')
    } finally {
      setEnviandoPdf(null)
    }
  }
  const publicar = async (item: ItemProposta) => {
    if (!item.proposta) return ''
    try {
      const resultado = await publicarProposta(item.negocio.id, item.proposta.updated)
      const link = `${window.location.origin}/p/${resultado.token}`
      setLinksPublicos((atual) => ({ ...atual, [item.negocio.id]: link }))
      await navigator.clipboard.writeText(link)
      toast.success('Link seguro criado e copiado.')
      return link
    } catch (_) {
      toast.error('Não foi possível publicar a proposta.')
      return ''
    }
  }
  const revogar = async (item: ItemProposta) => {
    try {
      await revogarPublicacaoProposta(item.negocio.id)
      setLinksPublicos((atual) => ({ ...atual, [item.negocio.id]: '' }))
      toast.success('Link da proposta revogado.')
    } catch (_) {
      toast.error('Não foi possível revogar o link.')
    }
  }
  const enviarEmail = async (item: ItemProposta) => {
    const email = (destinosEmail[item.negocio.id] || item.proposta?.destinatario || '').trim()
    const link = linksPublicos[item.negocio.id] || (await publicar(item))
    const assunto = (assuntosEmail[item.negocio.id] || assuntoPadrao(item)).trim()
    const corpo = (mensagensEmail[item.negocio.id] || mensagemPadrao(item)).trim()
    const replyTo = (
      respostasEmail[item.negocio.id] || String(pb.authStore.record?.email || '')
    ).trim()
    if (!email || !link || !assunto || !corpo || !replyTo) {
      toast.error('Preencha destinatário, responder para, assunto e mensagem.')
      return
    }
    const cc = (copiasEmail[item.negocio.id] || '')
      .split(/[;,\n]/)
      .map((valor) => valor.trim())
      .filter(Boolean)
    try {
      await enviarPropostaPorEmail(
        item.negocio.id,
        { destinatario: email, cc, reply_to: replyTo, assunto, corpo },
        link,
      )
      toast.success('Envio solicitado com rastreamento.')
      await carregarTimeline(item.negocio.id)
    } catch (_) {
      toast.error('Não foi possível enviar a proposta por e-mail.')
    }
  }
  const copiarMensagemWhatsApp = async (item: ItemProposta) => {
    const link = linksPublicos[item.negocio.id] || (await publicar(item))
    if (!link) return
    const mensagem = (mensagensEmail[item.negocio.id] || mensagemPadrao(item)).replace(
      '[LINK_PROPOSTA]',
      link,
    )
    await navigator.clipboard.writeText(mensagem)
    toast.success('Mensagem com o link copiada para o WhatsApp.')
  }
  const alterarIdentificacao = async () => {
    const novoValor = !identificacaoObrigatoria
    const justificativa = window.prompt(
      `${novoValor ? 'Ativar' : 'Desativar'} a identificação obrigatória? Informe a justificativa:`,
    )
    if (!justificativa || justificativa.trim().length < 12) {
      if (justificativa !== null) toast.error('A justificativa deve ter pelo menos 12 caracteres.')
      return
    }
    try {
      const resultado = await configurarIdentificacaoVisitante(
        novoValor,
        identificacaoUpdated,
        justificativa.trim(),
      )
      setIdentificacaoObrigatoria(resultado.obrigatoria)
      setIdentificacaoUpdated(resultado.updated)
      toast.success('Configuração de identificação atualizada e auditada.')
    } catch (_) {
      toast.error('Não foi possível alterar a identificação. Atualize a página e tente novamente.')
    }
  }
  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ciclo de propostas</h1>
          <p className="text-sm text-muted-foreground">
            Preparação, aprovação, emissão, visualização e decisão auditáveis
          </p>
        </div>
        <Button variant="outline" onClick={() => void carregar()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>
      <CommercialFilters
        contexts={itens.map((item) => item.contexto)}
        search={busca}
        owner={responsavel}
        status={situacaoAcao}
        sort={ordenacao}
        onSearch={setBusca}
        onOwner={setResponsavel}
        onStatus={setSituacaoAcao}
        onSort={setOrdenacao}
        periodStart={periodoInicio}
        periodEnd={periodoFim}
        onPeriodStart={setPeriodoInicio}
        onPeriodEnd={setPeriodoFim}
      />
      {isSuperAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-3 text-sm">
          <div>
            <p className="font-medium">Identificação do visitante</p>
            <p className="text-muted-foreground">
              Nome antes da abertura: {identificacaoObrigatoria ? 'obrigatório' : 'opcional'}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!identificacaoUpdated}
            onClick={() => void alterarIdentificacao()}
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Tornar {identificacaoObrigatoria ? 'opcional' : 'obrigatório'}
          </Button>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {itensVisiveis.map((item) => {
          const p = item.proposta
          const timeline = timelines[item.negocio.id]
          const acessos = timeline?.eventos_publicos.filter(
            (evento) => evento.tipo === 'pagina_acessada',
          )
          const primeiroAcesso = acessos?.[0]?.ocorrido_em ?? null
          const ultimoAcesso = acessos?.[acessos.length - 1]?.ocorrido_em ?? null
          const eventosHistorico = timeline
            ? [
                ...timeline.versoes.map((versao) => ({
                  id: `versao-${versao.id}`,
                  ocorridoEm: versao.created,
                  titulo: `Versão ${versao.numero} — ${versao.arquivo_bytes ? 'PDF lançado' : 'PDF pendente'}`,
                  detalhe: 'Versão registrada na proposta',
                  tipo: 'versao',
                })),
                ...timeline.envios.map((envio) => ({
                  id: `envio-${envio.id}`,
                  ocorridoEm: envio.enviado_em || envio.created,
                  titulo: `${envio.canal === 'email' ? 'E-mail' : 'WhatsApp'} ${envio.estado}`,
                  detalhe: envio.destinatario || 'Destinatário não informado',
                  tipo: 'envio',
                })),
                ...timeline.eventos_publicos.map((evento) => ({
                  id: `evento-${evento.id}`,
                  ocorridoEm: evento.ocorrido_em,
                  titulo: rotuloEventoPublico[evento.tipo] || 'Ação registrada',
                  detalhe: evento.visitante_nome || 'Visitante não identificado',
                  tipo: evento.tipo,
                })),
              ].sort((a, b) => new Date(b.ocorridoEm).getTime() - new Date(a.ocorridoEm).getTime())
            : []
          const envioSistemaEm = p?.ultimo_envio_sistema_em
            ? new Date(p.ultimo_envio_sistema_em).getTime()
            : null
          const naoAbertaAtrasada = Boolean(
            p?.enviada_sistema &&
            !p.aberta &&
            envioSistemaEm &&
            Date.now() - envioSistemaEm >= 24 * 60 * 60 * 1000,
          )
          const estadoProposta = p
            ? p.enviada_sistema
              ? 'Enviada'
              : p.estado === 'rascunho'
                ? 'Rascunho'
                : p.estado.charAt(0).toLocaleUpperCase('pt-BR') + p.estado.slice(1)
            : item.negocio.etapa === 'negociacao'
              ? 'Proposta em negociação'
              : 'Proposta em produção'
          return (
            <Card
              key={item.negocio.id}
              className={commercialActionCardClass(item.contexto.proxima_acao_em)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{item.negocio.titulo}</CardTitle>
                    <CardDescription>{rotuloEtapaComercial(item.negocio.etapa)}</CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="secondary">{estadoProposta}</Badge>
                    {p && (
                      <Badge
                        variant="outline"
                        className={
                          p.aberta
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : naoAbertaAtrasada
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : undefined
                        }
                        title={
                          p.aberta && p.primeiro_acesso_publicacao_em
                            ? `Primeiro acesso: ${new Date(p.primeiro_acesso_publicacao_em).toLocaleString('pt-BR')}`
                            : 'A publicação vigente ainda não foi aberta'
                        }
                      >
                        {p.aberta ? (
                          <Eye className="mr-1 h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="mr-1 h-3.5 w-3.5" />
                        )}
                        {p.aberta ? 'Aberta' : 'Não Aberta'}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <CommercialContextCard
                  contexto={item.contexto}
                  etapa={item.negocio.etapa}
                  negocioId={item.negocio.id}
                  showReadOnlyNotice={false}
                />
                <div className="flex flex-wrap items-center gap-2">
                  {!somenteNegociacao &&
                    !somenteLeituraPerfil &&
                    !item.contexto.somente_leitura && (
                      <Button size="sm" onClick={() => abrirModal(item.negocio.id, 'operacao')}>
                        <FileCheck2 className="mr-2 h-4 w-4" />
                        Lançar proposta
                      </Button>
                    )}
                  {p && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirModal(item.negocio.id, 'historico')}
                    >
                      <History className="mr-2 h-4 w-4" />
                      Histórico
                    </Button>
                  )}
                </div>
                <Dialog
                  open={modalProposta?.negocioId === item.negocio.id}
                  onOpenChange={(aberta) => !aberta && setModalProposta(null)}
                >
                  <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {modalProposta?.modo === 'historico'
                          ? 'Histórico da proposta'
                          : 'Lançar proposta'}
                      </DialogTitle>
                      <DialogDescription>
                        {item.contexto.empresa.nome} · negócio {item.contexto.external_id}
                      </DialogDescription>
                    </DialogHeader>
                    {modalProposta?.modo === 'historico' ? (
                      <div className="space-y-5">
                        {!timeline ? (
                          <p className="text-sm text-muted-foreground">Carregando histórico…</p>
                        ) : (
                          <>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              <div className="rounded-lg border bg-card p-4">
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Estado
                                </p>
                                <p className="mt-2 font-semibold">{estadoProposta}</p>
                              </div>
                              <div className="rounded-lg border bg-card p-4">
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Acessos
                                </p>
                                <p className="mt-2 text-xl font-semibold">
                                  {timeline.total_acessos}
                                </p>
                              </div>
                              <div className="rounded-lg border bg-card p-4">
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Primeiro acesso
                                </p>
                                <p className="mt-2 text-sm font-medium">
                                  {dataHora(primeiroAcesso)}
                                </p>
                              </div>
                              <div className="rounded-lg border bg-card p-4">
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  Último acesso
                                </p>
                                <p className="mt-2 text-sm font-medium">{dataHora(ultimoAcesso)}</p>
                              </div>
                            </div>
                            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
                              <section className="rounded-lg border p-4 sm:p-5">
                                <h3 className="font-semibold">Linha do tempo</h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  Lançamento, envio, acesso e ações em ordem cronológica.
                                </p>
                                <div className="mt-5 space-y-0">
                                  {eventosHistorico.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                      Nenhum evento registrado.
                                    </p>
                                  ) : (
                                    eventosHistorico.map((evento, indice) => (
                                      <div
                                        key={evento.id}
                                        className="relative flex gap-3 pb-5 last:pb-0"
                                      >
                                        {indice < eventosHistorico.length - 1 && (
                                          <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-border" />
                                        )}
                                        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground">
                                          {evento.tipo === 'pagina_acessada' ? (
                                            <Eye className="h-4 w-4" />
                                          ) : evento.tipo === 'pdf_baixado' ? (
                                            <Download className="h-4 w-4" />
                                          ) : evento.tipo === 'envio' ? (
                                            <Mail className="h-4 w-4" />
                                          ) : (
                                            <CheckCircle2 className="h-4 w-4" />
                                          )}
                                        </span>
                                        <div className="min-w-0 pt-0.5 text-sm">
                                          <p className="font-medium">{evento.titulo}</p>
                                          <p className="break-words text-muted-foreground">
                                            {evento.detalhe}
                                          </p>
                                          <p className="mt-1 text-xs text-muted-foreground">
                                            {dataHora(evento.ocorridoEm)}
                                          </p>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </section>
                              <aside className="space-y-4">
                                <div className="rounded-lg border p-4">
                                  <h3 className="font-semibold">Situação</h3>
                                  <div className="mt-3 space-y-3 text-sm">
                                    <p className="flex items-center gap-2">
                                      <UserRound className="h-4 w-4 text-muted-foreground" />
                                      {acessos?.at(-1)?.visitante_nome ||
                                        'Sem visitante identificado'}
                                    </p>
                                    <p className="flex items-center gap-2">
                                      <Download className="h-4 w-4 text-muted-foreground" />
                                      {timeline.total_downloads} download(s)
                                    </p>
                                    <p className="flex items-center gap-2">
                                      <CalendarClock className="h-4 w-4 text-muted-foreground" />
                                      Decisão: {rotuloDecisao[timeline.decisao] || timeline.decisao}
                                    </p>
                                  </div>
                                  {timeline.decisao_motivo && (
                                    <p className="mt-3 rounded-md bg-muted p-3 text-sm">
                                      {timeline.decisao_motivo}
                                    </p>
                                  )}
                                </div>
                                <div className="rounded-lg border p-4">
                                  <h3 className="font-semibold">Ações</h3>
                                  <p className="mt-2 text-sm text-muted-foreground">
                                    Para gerar link, enviar ou reenviar a proposta, use Lançar
                                    proposta.
                                  </p>
                                  <Button
                                    className="mt-3 w-full"
                                    variant="outline"
                                    onClick={() =>
                                      setModalProposta({
                                        negocioId: item.negocio.id,
                                        modo: 'operacao',
                                      })
                                    }
                                  >
                                    <FileCheck2 className="mr-2 h-4 w-4" />
                                    Lançar proposta
                                  </Button>
                                </div>
                              </aside>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {!p ? (
                          <div className="space-y-3 rounded-md border p-4">
                            <p className="text-sm">
                              Valor da proposta: {reais(item.contexto.valor_centavos)} —
                              sincronizado do ActiveCampaign
                            </p>
                            <Button
                              disabled={
                                item.contexto.valor_centavos <= 0 || !item.contexto.modalidade
                              }
                              onClick={() => void executar(item, 'preparar')}
                            >
                              Iniciar lançamento
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="rounded-md bg-muted p-3">
                              <p className="font-medium">
                                Versão {p.numero} —{' '}
                                {p.pdf_disponivel ? 'PDF lançado' : 'PDF pendente'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {reais(p.valor_total_centavos)}
                              </p>
                            </div>
                            {p.estado === 'rascunho' && !p.aprovada && aprovacaoObrigatoria && (
                              <Button onClick={() => void executar(item, 'aprovar')}>
                                Aprovar
                              </Button>
                            )}
                            {p.estado === 'rascunho' && p.aprovada && aprovacaoObrigatoria && (
                              <p className="text-sm text-muted-foreground">
                                Aprovação interna concluída.
                              </p>
                            )}
                            {p.estado === 'rascunho' && (
                              <div className="space-y-3 rounded-md border p-4">
                                <p className="text-sm text-muted-foreground">
                                  Crie a versão privada do PDF, gere o link e escolha o canal de
                                  envio.
                                </p>
                                <Label htmlFor={`pdf-${item.negocio.id}`}>Lançar novo PDF</Label>
                                <Input
                                  id={`pdf-${item.negocio.id}`}
                                  type="file"
                                  accept="application/pdf,.pdf"
                                  onChange={(event) =>
                                    setArquivos((atual) => ({
                                      ...atual,
                                      [item.negocio.id]: event.target.files?.[0] ?? null,
                                    }))
                                  }
                                />
                                <Button
                                  disabled={
                                    !arquivos[item.negocio.id] || enviandoPdf === item.negocio.id
                                  }
                                  onClick={() => void enviarPdf(item)}
                                >
                                  <FileUp className="mr-2 h-4 w-4" />
                                  Lançar PDF
                                </Button>
                              </div>
                            )}
                            {p.estado === 'rascunho' && (
                              <div className="space-y-3 rounded-md border p-4">
                                <div>
                                  <h3 className="font-semibold">Publicar e enviar</h3>
                                  <p className="text-sm text-muted-foreground">
                                    Revise a comunicação. O PDF será acessado pelo link seguro e não
                                    será anexado.
                                  </p>
                                </div>
                                {linksPublicos[item.negocio.id] && (
                                  <Input
                                    readOnly
                                    value={linksPublicos[item.negocio.id]}
                                    aria-label="Link seguro da proposta"
                                  />
                                )}
                                <div className="grid gap-4 sm:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label htmlFor={`email-proposta-${item.negocio.id}`}>
                                      Destinatário principal
                                    </Label>
                                    <Input
                                      id={`email-proposta-${item.negocio.id}`}
                                      type="email"
                                      value={destinosEmail[item.negocio.id] || p.destinatario || ''}
                                      onChange={(event) =>
                                        setDestinosEmail((atual) => ({
                                          ...atual,
                                          [item.negocio.id]: event.target.value,
                                        }))
                                      }
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor={`cc-proposta-${item.negocio.id}`}>
                                      Com cópia (Cc)
                                    </Label>
                                    <Input
                                      id={`cc-proposta-${item.negocio.id}`}
                                      placeholder="Separe vários e-mails por vírgula"
                                      value={copiasEmail[item.negocio.id] || ''}
                                      onChange={(event) =>
                                        setCopiasEmail((atual) => ({
                                          ...atual,
                                          [item.negocio.id]: event.target.value,
                                        }))
                                      }
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`reply-proposta-${item.negocio.id}`}>
                                    Responder para
                                  </Label>
                                  <Input
                                    id={`reply-proposta-${item.negocio.id}`}
                                    type="email"
                                    value={
                                      respostasEmail[item.negocio.id] ||
                                      String(pb.authStore.record?.email || '')
                                    }
                                    onChange={(event) =>
                                      setRespostasEmail((atual) => ({
                                        ...atual,
                                        [item.negocio.id]: event.target.value,
                                      }))
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`assunto-proposta-${item.negocio.id}`}>
                                    Assunto
                                  </Label>
                                  <Input
                                    id={`assunto-proposta-${item.negocio.id}`}
                                    value={assuntosEmail[item.negocio.id] || assuntoPadrao(item)}
                                    onChange={(event) =>
                                      setAssuntosEmail((atual) => ({
                                        ...atual,
                                        [item.negocio.id]: event.target.value,
                                      }))
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`mensagem-proposta-${item.negocio.id}`}>
                                    Mensagem
                                  </Label>
                                  <Textarea
                                    id={`mensagem-proposta-${item.negocio.id}`}
                                    className="min-h-48"
                                    value={mensagensEmail[item.negocio.id] || mensagemPadrao(item)}
                                    onChange={(event) =>
                                      setMensagensEmail((atual) => ({
                                        ...atual,
                                        [item.negocio.id]: event.target.value,
                                      }))
                                    }
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Use [LINK_PROPOSTA] para posicionar o botão de acesso.
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    disabled={!p.pdf_disponivel}
                                    onClick={() => void enviarEmail(item)}
                                  >
                                    <Mail className="mr-2 h-4 w-4" /> Publicar e enviar por e-mail
                                  </Button>
                                  <Button
                                    variant="outline"
                                    disabled={!p.pdf_disponivel}
                                    onClick={() => void publicar(item)}
                                  >
                                    <Link2 className="mr-2 h-4 w-4" /> Somente publicar
                                  </Button>
                                  <Button
                                    variant="outline"
                                    disabled={!p.pdf_disponivel}
                                    onClick={() => void copiarMensagemWhatsApp(item)}
                                  >
                                    <MessageCircle className="mr-2 h-4 w-4" /> Copiar mensagem para
                                    WhatsApp
                                  </Button>
                                  {linksPublicos[item.negocio.id] && (
                                    <Button
                                      variant="destructive"
                                      onClick={() => void revogar(item)}
                                    >
                                      Revogar link
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}
                            {p.estado === 'rascunho' && p.aprovada && aprovacaoObrigatoria && (
                              <div className="space-y-2 rounded-md border p-4">
                                <Label htmlFor={`proposta-${item.negocio.id}`}>
                                  Destinatário para emissão
                                </Label>
                                <Input
                                  id={`proposta-${item.negocio.id}`}
                                  value={valores[item.negocio.id] || ''}
                                  onChange={(event) =>
                                    setValores((atual) => ({
                                      ...atual,
                                      [item.negocio.id]: event.target.value,
                                    }))
                                  }
                                />
                                <Button
                                  disabled={!valores[item.negocio.id]?.trim()}
                                  onClick={() => void executar(item, 'emitir')}
                                >
                                  Emitir
                                </Button>
                              </div>
                            )}
                            {p.estado === 'enviada' && (
                              <div className="space-y-2 rounded-md border p-4">
                                <Label htmlFor={`proposta-${item.negocio.id}`}>
                                  Evidência da decisão
                                </Label>
                                <Input
                                  id={`proposta-${item.negocio.id}`}
                                  value={valores[item.negocio.id] || ''}
                                  onChange={(event) =>
                                    setValores((atual) => ({
                                      ...atual,
                                      [item.negocio.id]: event.target.value,
                                    }))
                                  }
                                />
                                <div className="flex flex-wrap gap-2">
                                  {!p.visualizada && (
                                    <Button
                                      variant="outline"
                                      onClick={() => void executar(item, 'visualizar')}
                                    >
                                      Registrar visualização
                                    </Button>
                                  )}
                                  <Button
                                    disabled={!valores[item.negocio.id]?.trim()}
                                    onClick={() => void executar(item, 'decidir')}
                                  >
                                    Registrar aceite
                                  </Button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        {podeDevolverQualificacao && item.negocio.etapa === 'producao_proposta' && (
                          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                            <Label htmlFor={`devolver-${item.negocio.id}`}>
                              Motivo para devolver à Qualificação
                            </Label>
                            <Input
                              id={`devolver-${item.negocio.id}`}
                              value={motivoDevolucao[item.negocio.id] || ''}
                              onChange={(event) =>
                                setMotivoDevolucao((atual) => ({
                                  ...atual,
                                  [item.negocio.id]: event.target.value,
                                }))
                              }
                            />
                            <Button
                              variant="outline"
                              disabled={!motivoDevolucao[item.negocio.id]?.trim()}
                              onClick={() => void devolver(item)}
                            >
                              Devolver para Qualificação
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
