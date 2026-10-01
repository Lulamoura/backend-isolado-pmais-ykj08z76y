import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  obterStatusWhatsAppUazapi,
  resolverAmbiguidadeWhatsApp,
  type WhatsAppAmbiguidadeNegocio,
  type WhatsAppUazapiResumo,
} from '@/services/whatsapp-uazapi'
import {
  ehOperadorComercial,
  formatarDataHoraRecife,
  rotuloDirecao,
  rotuloEstadoOperacional,
  rotuloEventoWhatsApp,
  rotuloMidia,
} from '@/lib/whatsapp-uazapi-display'

function valorDoResumo(dados: Record<string, unknown> | null | undefined, campo: string) {
  return dados?.[campo]
}

function textoDoResumo(dados: Record<string, unknown> | null | undefined, campo: string) {
  const valor = valorDoResumo(dados, campo)
  return typeof valor === 'string' ? valor : ''
}

function formatarPercentual(value?: number) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0%'
  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function formatarMoeda(value?: number) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return ''
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function rotuloEtapa(value?: string) {
  const mapa: Record<string, string> = {
    prospects: 'Prospecção',
    producao_proposta: 'Produção da proposta',
    negociacao: 'Negociação',
  }
  return value ? mapa[value] || 'Em andamento' : 'Em andamento'
}

function rotuloSinal(chave: string) {
  const mapa: Record<string, string> = {
    possivel_retorno_cliente: 'Possível retorno do cliente',
    possivel_prazo: 'Possível prazo combinado',
    possivel_proposta: 'Possível proposta, valor ou contrato',
    possivel_objeção: 'Possível objeção comercial',
    audio_pendente: 'Áudio ou mídia pendente',
  }
  return mapa[chave] || chave.replace(/_/g, ' ')
}

function ResumoOperacional({
  titulo,
  momento,
  linhas,
  indisponivel = false,
}: {
  titulo: string
  momento: unknown
  linhas: Array<{ rotulo: string; valor: string }>
  indisponivel?: boolean
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-slate-900">{titulo}</CardTitle>
        <CardDescription>
          Última atualização: {formatarDataHoraRecife(momento)} — horário de Recife
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-slate-700">
        {indisponivel ? (
          <p className="text-amber-800">Dados temporariamente indisponíveis.</p>
        ) : (
          linhas.map((linha) => (
            <div
              key={linha.rotulo}
              className="flex justify-between gap-4 border-b border-slate-100 pb-1 last:border-0"
            >
              <span className="text-slate-500">{linha.rotulo}</span>
              <span className="text-right font-medium text-slate-900">{linha.valor}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

export default function WhatsAppUazapi() {
  const [status, setStatus] = useState<WhatsAppUazapiResumo | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [selecionados, setSelecionados] = useState<Record<string, string[]>>({})
  const [resolvendo, setResolvendo] = useState<string | null>(null)

  async function carregar() {
    setLoading(true)
    setStatus(null)
    setSelecionados({})
    setErro(null)
    try {
      setStatus(await obterStatusWhatsAppUazapi())
    } catch (_) {
      setStatus(null)
      setErro('Não foi possível carregar o monitoramento do WhatsApp agora.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [])

  const counts = status?.counts
  const qualidade = status?.qualidade_base
  const sinaisBase = Object.entries(qualidade?.sinais_comerciais_iniciais || {})
  const operadoresComerciais =
    qualidade?.por_operador?.filter((item) => ehOperadorComercial(item.label)) || []
  const ambiguidades = status?.ambiguidades_negocios_abertos || []
  const fontesIndisponiveis = new Set(status?.fontes_indisponiveis || [])
  const filaIndisponivel = fontesIndisponiveis.has('detalhes_ambiguidades')
  const mensagensQualidadeIndisponivel = fontesIndisponiveis.has('mensagens_qualidade')
  const vinculosQualidadeIndisponivel = fontesIndisponiveis.has('vinculos_qualidade')
  const midiasQualidadeIndisponivel = fontesIndisponiveis.has('midias_qualidade')
  const relacionamentosQualidadeIndisponiveis =
    mensagensQualidadeIndisponivel || vinculosQualidadeIndisponivel
  const sinaisIndisponiveis = mensagensQualidadeIndisponivel && midiasQualidadeIndisponivel
  const sinais = sinaisBase.filter(([chave]) =>
    chave === 'audio_pendente' ? !midiasQualidadeIndisponivel : !mensagensQualidadeIndisponivel,
  )
  const valorContador = (fonte: string, valor: number | undefined) => {
    if (loading) return '...'
    return fontesIndisponiveis.has(fonte) ? 0 : (valor ?? 0)
  }

  const nomeOperador = (dados?: Record<string, unknown> | null) => {
    const instancia = textoDoResumo(dados, 'instance_name')
    return ehOperadorComercial(instancia) ? instancia : 'Processamento automático'
  }

  function alternarNegocio(vinculoId: string, negocioId: string, marcado: boolean) {
    setSelecionados((atual) => {
      const anteriores = atual[vinculoId] || []
      const proximos = marcado
        ? Array.from(new Set([...anteriores, negocioId]))
        : anteriores.filter((id) => id !== negocioId)
      return { ...atual, [vinculoId]: proximos }
    })
  }

  async function confirmarVinculo(item: WhatsAppAmbiguidadeNegocio) {
    const negocioIds = selecionados[item.id] || []
    if (!negocioIds.length) return
    setResolvendo(item.id)
    try {
      await resolverAmbiguidadeWhatsApp(item.id, negocioIds)
      setSelecionados((atual) => {
        const proximo = { ...atual }
        delete proximo[item.id]
        return proximo
      })
      setLoading(true)
      setStatus(null)
      try {
        setStatus(await obterStatusWhatsAppUazapi())
        setSelecionados({})
        setErro(null)
        toast.success('Vínculo confirmado.')
      } catch (_) {
        setStatus(null)
        setErro('O vínculo foi confirmado, mas a fila não pôde ser atualizada agora.')
        toast.success('Vínculo confirmado. Atualize a fila para conferir os novos números.')
      } finally {
        setLoading(false)
      }
    } catch (_) {
      toast.error('Não foi possível confirmar o vínculo. Atualize a fila e tente novamente.')
    } finally {
      setResolvendo(null)
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
            WhatsApp Comercial
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">Integração WhatsApp</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Área administrativa restrita para acompanhar a saúde da integração, a qualidade da base
            de conversas e a preparação governada para uso pelo Nexo.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void carregar()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Atualizar
        </Button>
      </div>

      {erro && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Falha de monitoramento</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {status && fontesIndisponiveis.size > 0 && (
        <p role="status" className="text-sm text-amber-800">
          {status.visao_restrita
            ? 'Alguns indicadores não estão disponíveis para este perfil.'
            : 'Alguns indicadores não puderam ser atualizados agora.'}
        </p>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Eventos hoje</CardDescription>
            <CardTitle className="text-3xl">
              {valorContador('eventos_hoje', counts?.eventos_hoje ?? counts?.eventos_24h)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Mensagens hoje</CardDescription>
            <CardTitle className="text-3xl">
              {valorContador('mensagens_hoje', counts?.mensagens_hoje ?? counts?.mensagens_24h)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Mídias pendentes</CardDescription>
            <CardTitle className="text-3xl">
              {valorContador('midias_pendentes', counts?.midias_pendentes)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Transcrições pendentes</CardDescription>
            <CardTitle className="text-3xl">
              {valorContador('transcricoes_pendentes', counts?.transcricoes_pendentes)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Vínculos pendentes</CardDescription>
            <CardTitle className="text-3xl">
              {valorContador('vinculos_pendentes', counts?.vinculos_pendentes)}
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="space-y-4" aria-labelledby="ambiguidades-titulo">
        <div>
          <h2 id="ambiguidades-titulo" className="text-xl font-semibold text-slate-950">
            Ambiguidades para decisão
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Analise a conversa e confirme todos os negócios que fazem parte do mesmo atendimento.
          </p>
        </div>

        {loading && !status ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-slate-500">
              Carregando ambiguidades...
            </CardContent>
          </Card>
        ) : !status || filaIndisponivel ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="py-8 text-center text-sm text-amber-950">
              A fila de ambiguidades está temporariamente indisponível. Atualize para tentar
              novamente.
            </CardContent>
          </Card>
        ) : ambiguidades.length ? (
          ambiguidades.map((item) => {
            const idsSelecionados = selecionados[item.id] || []
            const operador = ehOperadorComercial(item.operador) ? item.operador : 'Equipe comercial'
            return (
              <Card key={item.id} className="border-blue-100 shadow-sm">
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {item.contato || 'Contato não identificado'}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {[item.empresa, operador].filter(Boolean).join(' · ')}
                      </CardDescription>
                    </div>
                    <span className="text-xs text-slate-500">
                      Última interação: {formatarDataHoraRecife(item.ultima_interacao)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Contexto recente</h3>
                    <div className="mt-2 space-y-2">
                      {item.mensagens_recentes?.length ? (
                        item.mensagens_recentes.map((mensagem, indice) => {
                          const autorMensagem =
                            mensagem.direcao === 'enviada_operadora'
                              ? ehOperadorComercial(mensagem.autor)
                                ? mensagem.autor
                                : 'Equipe comercial'
                              : mensagem.autor || 'Contato'
                          return (
                            <div
                              key={`${item.id}-mensagem-${indice}`}
                              className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                                <span>{autorMensagem}</span>
                                <span>{formatarDataHoraRecife(mensagem.momento)}</span>
                              </div>
                              <p className="mt-1 whitespace-pre-wrap leading-6">
                                {mensagem.texto || 'Mensagem sem texto disponível.'}
                              </p>
                            </div>
                          )
                        })
                      ) : (
                        <p className="text-sm text-slate-500">Sem trechos recentes disponíveis.</p>
                      )}
                    </div>
                  </div>

                  <fieldset>
                    <legend className="text-sm font-semibold text-slate-900">
                      Negócios relacionados à conversa
                    </legend>
                    <p className="mt-1 text-xs text-slate-500">
                      Se a conversa tratar de mais de um negócio, marque todos antes de confirmar.
                    </p>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      {item.selecao_indisponivel ? (
                        <p className="text-sm text-amber-800">
                          Esta conversa possui negócios demais para uma decisão segura nesta tela.
                          Solicite apoio administrativo.
                        </p>
                      ) : (item.negocios_candidatos || []).length ? (
                        (item.negocios_candidatos || []).map((negocio) => {
                          const checkboxId = `ambiguidade-${item.id}-${negocio.id}`
                          const marcado = idsSelecionados.includes(negocio.id)
                          return (
                            <label
                              key={negocio.id}
                              htmlFor={checkboxId}
                              className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
                                marcado ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'
                              }`}
                            >
                              <Checkbox
                                id={checkboxId}
                                checked={marcado}
                                onCheckedChange={(valor) =>
                                  alternarNegocio(item.id, negocio.id, valor === true)
                                }
                                className="mt-1"
                              />
                              <span className="min-w-0 space-y-1">
                                <span className="block font-medium text-slate-950">
                                  {negocio.titulo}
                                </span>
                                <span className="block text-xs text-slate-700">
                                  Nº do negócio: {negocio.numero_comercial || 'Não informado'}
                                </span>
                                <span className="block text-xs text-slate-700">
                                  Cliente: {negocio.cliente || 'Não informado'}
                                </span>
                                <span className="block text-xs text-slate-700">
                                  Valor: {formatarMoeda(negocio.valor) || 'Não informado'}
                                </span>
                                <span className="block text-xs text-slate-700">
                                  Responsável: {negocio.responsavel || 'Não informado'}
                                </span>
                                <span className="block text-xs text-slate-600">
                                  Etapa: {rotuloEtapa(negocio.etapa)}
                                </span>
                                <span className="block text-xs text-slate-500">
                                  Atualizado em {formatarDataHoraRecife(negocio.atualizado_em)}
                                </span>
                              </span>
                            </label>
                          )
                        })
                      ) : (
                        <p className="text-sm text-amber-800">
                          Nenhum negócio aberto está disponível para esta conversa no momento.
                        </p>
                      )}
                    </div>
                  </fieldset>

                  <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">
                      {idsSelecionados.length
                        ? `${idsSelecionados.length} ${idsSelecionados.length === 1 ? 'negócio selecionado' : 'negócios selecionados'}`
                        : 'Selecione ao menos um negócio.'}
                    </p>
                    <Button
                      type="button"
                      disabled={
                        item.selecao_indisponivel ||
                        !idsSelecionados.length ||
                        resolvendo === item.id
                      }
                      onClick={() => void confirmarVinculo(item)}
                    >
                      {resolvendo === item.id ? 'Confirmando...' : 'Confirmar vínculo'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-slate-500">
              Nenhuma ambiguidade aguardando decisão.
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">
            Qualidade da base WhatsApp Comercial
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Leitura administrativa para saber se as conversas já estão confiáveis para a próxima
            camada do Nexo.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Mensagens avaliadas</CardDescription>
              <CardTitle className="text-3xl">
                {loading
                  ? '...'
                  : mensagensQualidadeIndisponivel
                    ? 0
                    : (qualidade?.total_mensagens_lidas ?? 0)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Conversas ligadas a negócio</CardDescription>
              <CardTitle className="text-3xl">
                {loading
                  ? '...'
                  : vinculosQualidadeIndisponivel
                    ? 0
                    : (qualidade?.conversas_vinculadas_negocio ??
                      qualidade?.vinculos_automaticos_negocio ??
                      0)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Aproveitamento para o Nexo</CardDescription>
              <CardTitle className="text-3xl">
                {loading
                  ? '...'
                  : relacionamentosQualidadeIndisponiveis
                    ? formatarPercentual(0)
                    : formatarPercentual(qualidade?.aproveitamento_nexo_percentual)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ambiguidades abertas</CardDescription>
              <CardTitle className="text-3xl">
                {loading
                  ? '...'
                  : vinculosQualidadeIndisponivel
                    ? 0
                    : (qualidade?.vinculos_ambiguos_negocio_aberto ?? 0)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
        <Alert className="border-blue-100 bg-blue-50 text-blue-950">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Leitura da base</AlertTitle>
          <AlertDescription>
            {relacionamentosQualidadeIndisponiveis
              ? 'A leitura da base não pôde ser atualizada agora.'
              : qualidade?.leitura || 'Aguardando dados suficientes para avaliar a base.'}
          </AlertDescription>
        </Alert>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Por operador</CardTitle>
            <CardDescription>
              Volume e situação das conversas por integrante da equipe comercial.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {relacionamentosQualidadeIndisponiveis ? (
              <p className="text-amber-800">Dados temporariamente indisponíveis.</p>
            ) : operadoresComerciais.length ? (
              operadoresComerciais.map((item) => (
                <div key={item.chave} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">{item.label}</p>
                      <p className="text-xs text-slate-500">
                        Última interação: {formatarDataHoraRecife(item.ultima_interacao)}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {item.total_mensagens} {item.total_mensagens === 1 ? 'mensagem' : 'mensagens'}
                      {typeof item.total_conversas === 'number'
                        ? ` · ${item.total_conversas} ${item.total_conversas === 1 ? 'conversa' : 'conversas'}`
                        : ''}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-3">
                    {typeof item.conversas_vinculadas_negocio === 'number' &&
                    typeof item.conversas_pendentes_ou_sem_vinculo === 'number' &&
                    typeof item.conversas_ambiguas === 'number' ? (
                      <>
                        <span>
                          {item.conversas_vinculadas_negocio}{' '}
                          {item.conversas_vinculadas_negocio === 1
                            ? 'conversa com negócio identificado'
                            : 'conversas com negócio identificado'}
                        </span>
                        <span>
                          {item.conversas_pendentes_ou_sem_vinculo}{' '}
                          {item.conversas_pendentes_ou_sem_vinculo === 1
                            ? 'conversa aguardando vínculo'
                            : 'conversas aguardando vínculo'}
                        </span>
                        <span>
                          {item.conversas_ambiguas}{' '}
                          {item.conversas_ambiguas === 1
                            ? 'conversa com mais de um negócio possível'
                            : 'conversas com mais de um negócio possível'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>
                          {item.vinculadas_negocio ?? 0}{' '}
                          {(item.vinculadas_negocio ?? 0) === 1
                            ? 'mensagem com negócio identificado'
                            : 'mensagens com negócio identificado'}
                        </span>
                        <span>
                          {item.pendentes_ou_sem_vinculo ?? 0}{' '}
                          {(item.pendentes_ou_sem_vinculo ?? 0) === 1
                            ? 'mensagem aguardando vínculo'
                            : 'mensagens aguardando vínculo'}
                        </span>
                        <span>
                          {item.ambiguas ?? 0}{' '}
                          {(item.ambiguas ?? 0) === 1
                            ? 'mensagem com mais de um negócio possível'
                            : 'mensagens com mais de um negócio possível'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500">Ainda sem volume por operador comercial.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Negócios com conversas recentes</CardTitle>
            <CardDescription>
              Conversas recentes organizadas pelo negócio comercial correspondente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {relacionamentosQualidadeIndisponiveis ? (
              <p className="text-amber-800">Dados temporariamente indisponíveis.</p>
            ) : qualidade?.negocios_com_conversas_recentes?.length ? (
              qualidade.negocios_com_conversas_recentes.map((item) => (
                <div key={item.chave} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">
                        {item.negocio_label || item.label || 'Negócio sem identificação'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {[
                          item.empresa,
                          item.contato,
                          ehOperadorComercial(item.operador) ? item.operador : '',
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Contexto em formação'}
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                      {item.total_mensagens} {item.total_mensagens === 1 ? 'mensagem' : 'mensagens'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Última interação: {formatarDataHoraRecife(item.ultima_interacao)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-slate-500">
                Ainda sem negócios vinculados com conversas recentes.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Sinais comerciais iniciais</CardTitle>
            <CardDescription>
              Sinais simples para calibragem. Não geram decisão automática nem conhecimento oficial.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-5">
            {sinaisIndisponiveis ? (
              <p className="text-amber-800">Dados temporariamente indisponíveis.</p>
            ) : sinais.length ? (
              sinais.map(([chave, valor]) => (
                <div key={chave} className="rounded-lg border border-slate-100 p-3">
                  <p className="text-xs text-slate-500">{rotuloSinal(chave)}</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950">{valor}</p>
                </div>
              ))
            ) : (
              <p className="text-slate-500">Ainda sem sinais calculados.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ResumoOperacional
          titulo="Recebimento da integração"
          indisponivel={fontesIndisponiveis.has('ultimo_webhook')}
          momento={valorDoResumo(status?.ultimo_webhook, 'received_at')}
          linhas={[
            {
              rotulo: 'Atividade',
              valor: rotuloEventoWhatsApp(textoDoResumo(status?.ultimo_webhook, 'event_type')),
            },
            { rotulo: 'Origem', valor: nomeOperador(status?.ultimo_webhook) },
            {
              rotulo: 'Situação',
              valor: rotuloEstadoOperacional(textoDoResumo(status?.ultimo_webhook, 'status')),
            },
          ]}
        />
        <ResumoOperacional
          titulo="Última conversa capturada"
          indisponivel={fontesIndisponiveis.has('ultima_mensagem')}
          momento={valorDoResumo(status?.ultima_mensagem, 'received_at')}
          linhas={[
            { rotulo: 'Responsável', valor: nomeOperador(status?.ultima_mensagem) },
            {
              rotulo: 'Direção',
              valor: rotuloDirecao(textoDoResumo(status?.ultima_mensagem, 'direcao')),
            },
            {
              rotulo: 'Situação',
              valor: rotuloEstadoOperacional(textoDoResumo(status?.ultima_mensagem, 'status')),
            },
          ]}
        />
        <ResumoOperacional
          titulo="Último arquivo identificado"
          indisponivel={fontesIndisponiveis.has('ultima_midia')}
          momento={valorDoResumo(status?.ultima_midia, 'received_at')}
          linhas={[
            {
              rotulo: 'Tipo de arquivo',
              valor: rotuloMidia(textoDoResumo(status?.ultima_midia, 'media_type')),
            },
            {
              rotulo: 'Recebimento',
              valor: rotuloEstadoOperacional(
                textoDoResumo(status?.ultima_midia, 'download_status'),
              ),
            },
            {
              rotulo: 'Transcrição',
              valor: rotuloEstadoOperacional(
                textoDoResumo(status?.ultima_midia, 'transcricao_status'),
              ),
            },
          ]}
        />
      </section>
    </main>
  )
}
