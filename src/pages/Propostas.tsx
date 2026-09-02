import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileCheck2, FileUp, History, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  listarPropostas,
  criarVersaoPdfProposta,
  novaChaveProposta,
  obterTimelineProposta,
  registrarEventoProposta,
  type EventoProposta,
  type ItemProposta,
  type VersaoPropostaInterna,
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
export default function Propostas() {
  const { perfilSlug } = useIsSuperAdmin()
  const somenteNegociacao = perfilSlug === 'negociacao-propria'
  const somenteLeituraPerfil = perfilSlug === 'leitura-executiva'
  const podeDevolverQualificacao =
    perfilSlug === 'superadministrador' || perfilSlug === 'gestor-comercial'
  const [itens, setItens] = useState<ItemProposta[]>([])
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
  const [timelines, setTimelines] = useState<Record<string, VersaoPropostaInterna[]>>({})
  const [enviandoPdf, setEnviandoPdf] = useState<string | null>(null)
  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      setItens((await listarPropostas()).itens)
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
      body.valor_total_centavos = Math.round(Number(entrada) * 100)
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
      setTimelines((atual) => ({ ...atual, [negocioId]: timeline.versoes }))
    } catch (_) {
      toast.error('Não foi possível carregar o histórico de versões.')
    }
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
      <div className="grid gap-4 md:grid-cols-2">
        {itensVisiveis.map((item) => {
          const p = item.proposta
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
                  <Badge variant="secondary">
                    {p?.estado ??
                      (item.negocio.etapa === 'negociacao'
                        ? 'Proposta em negociação'
                        : 'Proposta em produção')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <CommercialContextCard
                  contexto={item.contexto}
                  etapa={item.negocio.etapa}
                  negocioId={item.negocio.id}
                  showReadOnlyNotice={false}
                />
                {p && (
                  <div className="text-sm">
                    <p>
                      {reais(p.valor_total_centavos)} · versão {p.numero}
                    </p>
                    <p className="text-muted-foreground">
                      Aprovada: {p.aprovada ? 'Sim' : 'Não'} · Visualizada:{' '}
                      {p.visualizada ? 'Sim' : 'Não'}
                    </p>
                  </div>
                )}
                {p && p.estado === 'rascunho' && !somenteNegociacao && !somenteLeituraPerfil && (
                  <div className="space-y-2 rounded-md border p-3">
                    <Label htmlFor={`pdf-${item.negocio.id}`}>Nova versão do PDF</Label>
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
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={!arquivos[item.negocio.id] || enviandoPdf === item.negocio.id}
                        onClick={() => void enviarPdf(item)}
                      >
                        <FileUp className="mr-2 h-4 w-4" />
                        Criar versão privada
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void carregarTimeline(item.negocio.id)}
                      >
                        <History className="mr-2 h-4 w-4" />
                        Ver histórico
                      </Button>
                    </div>
                    {(timelines[item.negocio.id] || []).map((versao) => (
                      <div key={versao.id} className="rounded border bg-muted/30 p-2 text-xs">
                        <p>
                          Versão {versao.numero} · {versao.arquivo_nome || 'sem PDF'} ·{' '}
                          {versao.arquivo_bytes
                            ? `${(versao.arquivo_bytes / 1024 / 1024).toFixed(2)} MB`
                            : '—'}
                        </p>
                        {versao.arquivo_sha256 && (
                          <p className="truncate font-mono text-muted-foreground">
                            SHA-256: {versao.arquivo_sha256}
                          </p>
                        )}
                        <p className="text-muted-foreground">
                          {versao.eventos.length} evento(s) auditável(is)
                        </p>
                      </div>
                    ))}
                  </div>
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
                      size="sm"
                      variant="outline"
                      disabled={!motivoDevolucao[item.negocio.id]?.trim()}
                      onClick={() => void devolver(item)}
                    >
                      Devolver para Qualificação
                    </Button>
                  </div>
                )}
                {!somenteNegociacao && !somenteLeituraPerfil && !item.contexto.somente_leitura && (
                  <div className="space-y-2">
                    <Label htmlFor={`proposta-${item.negocio.id}`}>
                      {!p
                        ? 'Valor total em reais'
                        : p.estado === 'rascunho' && p.aprovada
                          ? 'Destinatário para emissão'
                          : p.estado === 'enviada'
                            ? 'Evidência da decisão'
                            : 'Informação complementar'}
                    </Label>
                    <Input
                      id={`proposta-${item.negocio.id}`}
                      value={valores[item.negocio.id] ?? ''}
                      onChange={(e) =>
                        setValores((v) => ({
                          ...v,
                          [item.negocio.id]: e.target.value,
                        }))
                      }
                    />
                  </div>
                )}
                {!somenteNegociacao && !somenteLeituraPerfil && !item.contexto.somente_leitura && (
                  <div className="flex flex-wrap gap-2">
                    {!p && (
                      <Button
                        size="sm"
                        disabled={!Number(valores[item.negocio.id])}
                        onClick={() => void executar(item, 'preparar')}
                      >
                        <FileCheck2 className="mr-2 h-4 w-4" />
                        Preparar
                      </Button>
                    )}
                    {p?.estado === 'rascunho' && !p.aprovada && (
                      <Button size="sm" onClick={() => void executar(item, 'aprovar')}>
                        Aprovar
                      </Button>
                    )}
                    {p?.estado === 'rascunho' && p.aprovada && (
                      <Button
                        size="sm"
                        disabled={!valores[item.negocio.id]?.trim()}
                        onClick={() => void executar(item, 'emitir')}
                      >
                        Emitir
                      </Button>
                    )}
                    {p?.estado === 'enviada' && !p.visualizada && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void executar(item, 'visualizar')}
                      >
                        Registrar visualização
                      </Button>
                    )}
                    {p?.estado === 'enviada' && (
                      <Button
                        size="sm"
                        disabled={!valores[item.negocio.id]?.trim()}
                        onClick={() => void executar(item, 'decidir')}
                      >
                        Registrar aceite
                      </Button>
                    )}
                  </div>
                )}
                {p && (
                  <p className="text-xs text-muted-foreground">
                    {p.eventos.length} evento(s) permanente(s) no histórico
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
