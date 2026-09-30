import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { obterStatusWhatsAppUazapi, type WhatsAppUazapiResumo } from '@/services/whatsapp-uazapi'
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
}: {
  titulo: string
  momento: unknown
  linhas: Array<{ rotulo: string; valor: string }>
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
        {linhas.map((linha) => (
          <div
            key={linha.rotulo}
            className="flex justify-between gap-4 border-b border-slate-100 pb-1 last:border-0"
          >
            <span className="text-slate-500">{linha.rotulo}</span>
            <span className="text-right font-medium text-slate-900">{linha.valor}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function WhatsAppUazapi() {
  const [status, setStatus] = useState<WhatsAppUazapiResumo | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    setLoading(true)
    setErro(null)
    try {
      setStatus(await obterStatusWhatsAppUazapi())
    } catch (_) {
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
  const sinais = Object.entries(qualidade?.sinais_comerciais_iniciais || {})
  const operadoresComerciais =
    qualidade?.por_operador?.filter((item) => ehOperadorComercial(item.label)) || []

  const nomeOperador = (dados?: Record<string, unknown> | null) => {
    const instancia = textoDoResumo(dados, 'instance_name')
    return ehOperadorComercial(instancia) ? instancia : 'Processamento automático'
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

      <Alert className="border-amber-200 bg-amber-50 text-amber-950">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Sem envio automático</AlertTitle>
        <AlertDescription>
          Esta área não envia mensagens a clientes. Ela monitora captura, vínculo com negócios e
          sinais iniciais para o Nexo, sem transformar conversas em conhecimento oficial sozinho.
        </AlertDescription>
      </Alert>

      {erro && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Falha de monitoramento</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {status && status.monitoramento_ok !== true && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-950">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Dados parciais no monitoramento</AlertTitle>
          <AlertDescription>
            Uma parte da captura não pôde ser conferida agora. Os números abaixo não devem ser
            interpretados como ausência de conversas. Atualize novamente ou acione a verificação da
            integração.
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Eventos hoje</CardDescription>
            <CardTitle className="text-3xl">
              {loading ? '...' : (counts?.eventos_hoje ?? counts?.eventos_24h ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Mensagens hoje</CardDescription>
            <CardTitle className="text-3xl">
              {loading ? '...' : (counts?.mensagens_hoje ?? counts?.mensagens_24h ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Mídias pendentes</CardDescription>
            <CardTitle className="text-3xl">
              {loading ? '...' : (counts?.midias_pendentes ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Transcrições pendentes</CardDescription>
            <CardTitle className="text-3xl">
              {loading ? '...' : (counts?.transcricoes_pendentes ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Vínculos pendentes</CardDescription>
            <CardTitle className="text-3xl">
              {loading ? '...' : (counts?.vinculos_pendentes ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
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
                {loading ? '...' : (qualidade?.total_mensagens_lidas ?? 0)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Conversas ligadas a negócio</CardDescription>
              <CardTitle className="text-3xl">
                {loading ? '...' : (qualidade?.mensagens_vinculadas_negocio ?? 0)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Aproveitamento para o Nexo</CardDescription>
              <CardTitle className="text-3xl">
                {loading ? '...' : formatarPercentual(qualidade?.aproveitamento_nexo_percentual)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ambiguidades abertas</CardDescription>
              <CardTitle className="text-3xl">
                {loading ? '...' : (qualidade?.vinculos_ambiguos_negocio_aberto ?? 0)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
        <Alert className="border-blue-100 bg-blue-50 text-blue-950">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Leitura da base</AlertTitle>
          <AlertDescription>
            {qualidade?.leitura || 'Aguardando dados suficientes para avaliar a base.'}
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
            {operadoresComerciais.length ? (
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
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-3">
                    <span>{item.vinculadas_negocio ?? 0} com negócio identificado</span>
                    <span>{item.pendentes_ou_sem_vinculo ?? 0} aguardando vínculo</span>
                    <span>{item.ambiguas ?? 0} com mais de um negócio possível</span>
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
            {qualidade?.negocios_com_conversas_recentes?.length ? (
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
            {sinais.length ? (
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
