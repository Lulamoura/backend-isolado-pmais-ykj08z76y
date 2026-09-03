import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Eye,
  EyeOff,
  FileCheck2,
  FileUp,
  History,
  Link2,
  MessageCircle,
  RefreshCw,
  Settings2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  prepararPropostaWhatsApp,
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
  const [destinosWhatsApp, setDestinosWhatsApp] = useState<Record<string, string>>({})
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
    if (!item.proposta) return
    try {
      const resultado = await publicarProposta(item.negocio.id, item.proposta.updated)
      const link = `${window.location.origin}/p/${resultado.token}`
      setLinksPublicos((atual) => ({ ...atual, [item.negocio.id]: link }))
      await navigator.clipboard.writeText(link)
      toast.success('Link seguro criado e copiado. O gate público permanece desligado.')
    } catch (_) {
      toast.error('Não foi possível publicar a proposta.')
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
    const email = destinosEmail[item.negocio.id]?.trim()
    const link = linksPublicos[item.negocio.id]
    if (!email || !link) return
    try {
      await enviarPropostaPorEmail(item.negocio.id, email, link)
      toast.success('Envio solicitado com rastreamento.')
      await carregarTimeline(item.negocio.id)
    } catch (_) {
      toast.info('O envio por e-mail permanece desabilitado neste ambiente.')
    }
  }
  const prepararWhatsApp = async (item: ItemProposta) => {
    const telefone = destinosWhatsApp[item.negocio.id]?.trim()
    const link = linksPublicos[item.negocio.id]
    if (!telefone || !link) return
    try {
      const resultado = await prepararPropostaWhatsApp(item.negocio.id, telefone, link)
      window.open(resultado.url_whatsapp, '_blank', 'noopener,noreferrer')
      toast.success('Mensagem preparada. O envio depende da confirmação no WhatsApp.')
      await carregarTimeline(item.negocio.id)
    } catch (_) {
      toast.error('Não foi possível preparar o compartilhamento.')
    }
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
                    <CardDescription>
                      {p?.identificador ?? 'Proposta originada no CRM'}
                    </CardDescription>
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
                  <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
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
                      <div className="space-y-4">
                        {!timelines[item.negocio.id] ? (
                          <p className="text-sm text-muted-foreground">Carregando histórico…</p>
                        ) : (
                          <>
                            <div className="grid gap-2 rounded-md bg-muted p-3 text-sm sm:grid-cols-3">
                              <p>{timelines[item.negocio.id].total_acessos} acesso(s)</p>
                              <p>{timelines[item.negocio.id].total_downloads} download(s)</p>
                              <p>Decisão: {timelines[item.negocio.id].decisao}</p>
                            </div>
                            <div className="space-y-2">
                              <h3 className="font-medium">Versões</h3>
                              {timelines[item.negocio.id].versoes.map((versao) => (
                                <div key={versao.id} className="rounded-md border p-3 text-sm">
                                  <p className="font-medium">
                                    Versão {versao.numero} —{' '}
                                    {versao.arquivo_bytes ? 'PDF lançado' : 'PDF pendente'}
                                  </p>
                                  <p className="text-muted-foreground">
                                    {dataHora(versao.created)}
                                  </p>
                                </div>
                              ))}
                            </div>
                            <div className="space-y-2">
                              <h3 className="font-medium">Acessos e ações do cliente</h3>
                              {timelines[item.negocio.id].eventos_publicos.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Nenhum acesso registrado.
                                </p>
                              ) : (
                                [...timelines[item.negocio.id].eventos_publicos]
                                  .reverse()
                                  .map((evento) => (
                                    <div key={evento.id} className="rounded-md border p-3 text-sm">
                                      <p className="font-medium">
                                        {rotuloEventoPublico[evento.tipo] || 'Ação registrada'}
                                      </p>
                                      <p className="text-muted-foreground">
                                        {evento.visitante_nome || 'Visitante não identificado'} ·{' '}
                                        {dataHora(evento.ocorrido_em)}
                                      </p>
                                    </div>
                                  ))
                              )}
                            </div>
                            <div className="space-y-2">
                              <h3 className="font-medium">Envios</h3>
                              {timelines[item.negocio.id].envios.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  Nenhum envio pelo sistema.
                                </p>
                              ) : (
                                [...timelines[item.negocio.id].envios].reverse().map((envio) => (
                                  <div key={envio.id} className="rounded-md border p-3 text-sm">
                                    <p className="font-medium">
                                      {envio.canal === 'email' ? 'E-mail' : 'WhatsApp'} —{' '}
                                      {envio.estado}
                                    </p>
                                    <p className="text-muted-foreground">
                                      {envio.destinatario || 'Destinatário não informado'} ·{' '}
                                      {dataHora(envio.enviado_em || envio.created)}
                                    </p>
                                  </div>
                                ))
                              )}
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
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    variant="outline"
                                    disabled={!p.pdf_disponivel}
                                    onClick={() => void publicar(item)}
                                  >
                                    <Link2 className="mr-2 h-4 w-4" /> Gerar link
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
                                {linksPublicos[item.negocio.id] && (
                                  <div className="space-y-4">
                                    <Input
                                      readOnly
                                      value={linksPublicos[item.negocio.id]}
                                      aria-label="Link seguro da proposta"
                                    />
                                    <div className="grid gap-4 sm:grid-cols-2">
                                      <div className="space-y-2">
                                        <Label htmlFor={`email-proposta-${item.negocio.id}`}>
                                          E-mail do cliente
                                        </Label>
                                        <Input
                                          id={`email-proposta-${item.negocio.id}`}
                                          type="email"
                                          value={destinosEmail[item.negocio.id] || ''}
                                          onChange={(event) =>
                                            setDestinosEmail((atual) => ({
                                              ...atual,
                                              [item.negocio.id]: event.target.value,
                                            }))
                                          }
                                        />
                                        <Button
                                          variant="outline"
                                          disabled={!destinosEmail[item.negocio.id]?.trim()}
                                          onClick={() => void enviarEmail(item)}
                                        >
                                          <Mail className="mr-2 h-4 w-4" /> Enviar por e-mail
                                        </Button>
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor={`whatsapp-proposta-${item.negocio.id}`}>
                                          WhatsApp do cliente
                                        </Label>
                                        <Input
                                          id={`whatsapp-proposta-${item.negocio.id}`}
                                          inputMode="tel"
                                          placeholder="5581999999999"
                                          value={destinosWhatsApp[item.negocio.id] || ''}
                                          onChange={(event) =>
                                            setDestinosWhatsApp((atual) => ({
                                              ...atual,
                                              [item.negocio.id]: event.target.value,
                                            }))
                                          }
                                        />
                                        <Button
                                          variant="outline"
                                          disabled={!destinosWhatsApp[item.negocio.id]?.trim()}
                                          onClick={() => void prepararWhatsApp(item)}
                                        >
                                          <MessageCircle className="mr-2 h-4 w-4" /> Preparar
                                          WhatsApp
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}
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
