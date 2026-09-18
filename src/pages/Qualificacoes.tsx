import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, RefreshCw, SearchX, UserCheck, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  assumirQualificacao,
  atribuirQualificacao,
  decidirQualificacao,
  listarQualificacoesPendentes,
  mapQualificacaoError,
  novaChaveQualificacao,
  type IndicadorQualificacao,
  type QualificacaoPendente,
} from '@/services/qualificacoes'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'
import { commercialActionCardClass } from '@/lib/commercial-context'
import pb from '@/lib/pocketbase/client'
import { BusinessNotesDialog } from '@/components/BusinessNotesDialog'
import { BusinessContactCard } from '@/components/BusinessContactCard'
import { NexoBusinessActions } from '@/components/NexoBusinessActions'

type Decisao = 'qualificada' | 'desqualificada'

const motivosDesqualificacao = [
  ['contato_invalido_dados_insuficientes', 'Contato inválido ou dados insuficientes'],
  ['contato_nao_estabelecido', 'Não foi possível estabelecer contato'],
  ['solicitacao_emprego_candidato', 'Solicitação de emprego/candidato'],
  ['fornecedor_assunto_nao_comercial', 'Fornecedor ou assunto não comercial'],
  ['servico_residencial', 'Serviço residencial'],
  ['oportunidade_pequena_sem_atratividade', 'Oportunidade pequena e sem atratividade'],
  ['prazo_mobilizacao_inviavel', 'Prazo de mobilização inviável'],
  ['fora_escopo_operacional', 'Fora do escopo operacional'],
  ['evento_sem_supervisao', 'Evento sem aceitação do custo de supervisão'],
  ['pos_obra_em_andamento', 'Pós-obra ainda em andamento'],
  ['localidade_esforco_inviavel', 'Localidade ou esforço operacional inviável'],
  ['duplicidade_teste_registro_indevido', 'Duplicidade, teste ou registro indevido'],
  ['desistencia_antes_proposta', 'Cliente desistiu antes da proposta'],
  ['outro', 'Outro'],
] as const

export default function Qualificacoes() {
  const { perfilSlug } = useIsSuperAdmin()
  const somenteLeitura = perfilSlug === 'leitura-executiva'
  const podeGerir = perfilSlug === 'superadministrador' || perfilSlug === 'gestor-comercial'
  const usuarioId = pb.authStore.record?.id || ''
  const [itens, setItens] = useState<QualificacaoPendente[]>([])
  const [responsaveisQualificacao, setResponsaveisQualificacao] = useState<
    Array<{ id: string; nome: string }>
  >([])
  const [indicadores, setIndicadores] = useState<IndicadorQualificacao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selecionado, setSelecionado] = useState<QualificacaoPendente | null>(null)
  const [decisao, setDecisao] = useState<Decisao>('qualificada')
  const [motivo, setMotivo] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [assumindo, setAssumindo] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const response = await listarQualificacoesPendentes()
      setItens(response.itens)
      setResponsaveisQualificacao(response.responsaveis_qualificacao || [])
      setIndicadores(response.indicadores || [])
    } catch (_) {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const abrir = (item: QualificacaoPendente, novaDecisao: Decisao) => {
    setSelecionado(item)
    setDecisao(novaDecisao)
    setMotivo('')
    setJustificativa('')
  }

  const confirmar = async () => {
    if (
      !selecionado ||
      (decisao === 'desqualificada' && !motivo) ||
      (decisao === 'desqualificada' && motivo === 'outro' && !justificativa.trim())
    )
      return
    setSalvando(true)
    try {
      await decidirQualificacao({
        negocio_id: selecionado.id,
        decisao,
        motivo: motivo.trim() || null,
        justificativa: justificativa.trim() || null,
        updated_esperado: selecionado.updated,
        command_idempotency_key: novaChaveQualificacao(selecionado.id),
      })
      setItens((atuais) => atuais.filter((item) => item.id !== selecionado.id))
      setSelecionado(null)
      toast.success(
        decisao === 'qualificada' ? 'Prospect qualificado.' : 'Prospect desqualificado.',
      )
    } catch (err) {
      toast.error(mapQualificacaoError(err))
    } finally {
      setSalvando(false)
    }
  }

  const assumir = async (item: QualificacaoPendente) => {
    setAssumindo(item.id)
    try {
      await assumirQualificacao(item.id, item.updated)
      toast.success('Qualificação atribuída a você.')
      await carregar()
    } catch (_) {
      toast.error('A qualificação já foi assumida ou o registro foi alterado.')
      await carregar()
    } finally {
      setAssumindo(null)
    }
  }

  const atribuir = async (item: QualificacaoPendente, responsavelId: string) => {
    setAssumindo(item.id)
    try {
      await atribuirQualificacao(item.id, responsavelId, item.updated)
      toast.success('Responsável pela qualificação atualizado.')
      await carregar()
    } catch (_) {
      toast.error('A atribuição não pôde ser atualizada.')
      await carregar()
    } finally {
      setAssumindo(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Etapa 1 · Triagem Comercial
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Qualificação</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
            Prospects aguardando decisão explícita sobre avanço para produção da proposta.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void carregar()}
          disabled={loading}
          className="gap-2 border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm"
        >
          <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />{' '}
          Atualizar
        </Button>
      </section>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Falha ao carregar</AlertTitle>
          <AlertDescription>Atualize a lista para tentar novamente.</AlertDescription>
        </Alert>
      )}
      {(podeGerir || somenteLeitura) && indicadores.length > 0 && (
        <Card className="border border-slate-200/80 bg-white shadow-sm border-l-4 border-l-amber-500">
          <CardHeader className="pb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Supervisão gerencial
            </p>
            <CardTitle className="text-base font-semibold text-slate-900">
              Acompanhamento por responsável
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Decisões autônomas das operadoras, com supervisão e rastreabilidade gerencial.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {indicadores.map((indicador) => (
              <div
                key={indicador.usuario_id}
                className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{indicador.nome}</p>
                  <Badge
                    variant="outline"
                    className="rounded-full border-amber-200/60 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                  >
                    {indicador.taxa_qualificacao.toLocaleString('pt-BR')}% taxa
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">{indicador.assumidos}</span>{' '}
                  assumidos ·{' '}
                  <span className="font-semibold text-emerald-700">{indicador.qualificados}</span>{' '}
                  qualificados ·{' '}
                  <span className="font-semibold text-rose-700">{indicador.desqualificados}</span>{' '}
                  desqualificados
                </p>
                <div className="mt-2 space-y-0.5 border-t border-slate-200/80 pt-2 text-xs text-slate-500">
                  <p>
                    Devoluções:{' '}
                    <span className="font-medium text-slate-700">{indicador.devolvidos}</span>
                  </p>
                  <p>
                    Tempo médio para assumir:{' '}
                    <span className="font-medium text-slate-700">
                      {indicador.tempo_medio_assumir_horas === null
                        ? '—'
                        : `${indicador.tempo_medio_assumir_horas.toLocaleString('pt-BR')} h`}
                    </span>
                  </p>
                  <p>
                    Tempo médio para decidir:{' '}
                    <span className="font-medium text-slate-700">
                      {indicador.tempo_medio_decidir_horas === null
                        ? '—'
                        : `${indicador.tempo_medio_decidir_horas.toLocaleString('pt-BR')} h`}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? null : itens.length === 0 ? (
        <Card className="border border-slate-200/80 bg-white shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="rounded-full bg-slate-100 p-3 text-slate-500">
              <SearchX className="h-6 w-6" />
            </span>
            <div>
              <p className="text-base font-semibold text-slate-900">Nenhum prospect pendente</p>
              <p className="text-sm text-slate-500">A fila de qualificação está em dia.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {itens.map((item) => {
            const assumidaPorMim = item.responsavel_qualificacao?.id === usuarioId
            const podeDecidir = assumidaPorMim || podeGerir
            return (
              <Card
                key={item.id}
                className={`border border-slate-200/80 bg-white shadow-sm transition-all duration-150 hover:shadow-md hover:border-slate-300 ${commercialActionCardClass(item.proxima_acao_em)}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Triagem
                      </p>
                      <CardTitle className="text-base font-semibold text-slate-900">
                        {item.titulo}
                      </CardTitle>
                      {item.external_id && (
                        <p className="mt-1 text-xs font-medium text-slate-500">
                          Negócio AC #{item.external_id}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className="rounded-full border-amber-200/60 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                    >
                      Qualificação pendente
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="line-clamp-3 text-sm text-slate-600 leading-relaxed">
                    {item.descricao || 'Necessidade ainda sem descrição.'}
                  </p>
                  <div className="text-xs text-slate-500">
                    <span>Origem: {item.origem_canal || 'não informada'}</span>
                    <span className="mx-2 text-slate-300">•</span>
                    <span>
                      Qualificação:{' '}
                      <span className="font-medium text-slate-700">
                        {item.responsavel_qualificacao?.nome || 'disponível para assumir'}
                      </span>
                    </span>
                  </div>
                  <BusinessContactCard empresa={item.empresa} contato={item.contato} />
                  <NexoBusinessActions
                    externalId={item.external_id}
                    businessTitle={item.titulo}
                    allowNexoHelp={true}
                  />
                  {!somenteLeitura && !item.responsavel_qualificacao && (
                    <Button
                      className="w-full gap-2 border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                      variant="outline"
                      disabled={assumindo === item.id}
                      onClick={() => void assumir(item)}
                    >
                      <UserCheck className="h-4 w-4 text-slate-600" />
                      {assumindo === item.id ? 'Assumindo…' : 'Assumir qualificação'}
                    </Button>
                  )}
                  {podeGerir && (
                    <Select
                      value={item.responsavel_qualificacao?.id || ''}
                      onValueChange={(value) => void atribuir(item, value)}
                      disabled={assumindo === item.id}
                    >
                      <SelectTrigger
                        aria-label="Responsável pela qualificação"
                        className="border-slate-200 bg-white text-slate-900"
                      >
                        <SelectValue placeholder="Atribuir qualificação" />
                      </SelectTrigger>
                      <SelectContent>
                        {responsaveisQualificacao.map((responsavel) => (
                          <SelectItem key={responsavel.id} value={responsavel.id}>
                            {responsavel.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {!somenteLeitura && podeDecidir && item.responsavel_qualificacao && (
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 gap-2 bg-emerald-600 text-white hover:bg-emerald-700 font-medium"
                        onClick={() => abrir(item, 'qualificada')}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Qualificar
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 gap-2 border-rose-200 bg-rose-50/60 text-rose-700 hover:bg-rose-100 hover:text-rose-800"
                        onClick={() => abrir(item, 'desqualificada')}
                      >
                        <XCircle className="h-4 w-4" />
                        Desqualificar
                      </Button>
                    </div>
                  )}
                  <BusinessNotesDialog negocioId={item.id} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog
        open={!!selecionado}
        onOpenChange={(open) => !open && !salvando && setSelecionado(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisao === 'qualificada' ? 'Confirmar qualificação' : 'Confirmar desqualificação'}
            </DialogTitle>
            <DialogDescription>
              {selecionado?.titulo}. A decisão será registrada com autor, data e histórico
              permanente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {decisao === 'desqualificada' && (
              <div className="space-y-2">
                <Label>Motivo *</Label>
                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {motivosDesqualificacao.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="justificativa">
                {decisao === 'desqualificada' && motivo === 'outro'
                  ? 'Justificativa de “Outro” *'
                  : 'Observação'}
              </Label>
              <Textarea
                id="justificativa"
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                maxLength={1000}
                placeholder="Contexto adicional, se necessário"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelecionado(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              onClick={() => void confirmar()}
              disabled={
                salvando ||
                (decisao === 'desqualificada' && !motivo) ||
                (decisao === 'desqualificada' && motivo === 'outro' && !justificativa.trim())
              }
            >
              {salvando ? 'Registrando…' : 'Confirmar decisão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
