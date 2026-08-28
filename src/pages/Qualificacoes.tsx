import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Mail, Phone, RefreshCw, SearchX, UserCheck, XCircle } from 'lucide-react'
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
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Qualificação</h1>
          <p className="text-sm text-muted-foreground">Prospects aguardando decisão explícita</p>
        </div>
        <Button
          variant="outline"
          onClick={() => void carregar()}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Falha ao carregar</AlertTitle>
          <AlertDescription>Atualize a lista para tentar novamente.</AlertDescription>
        </Alert>
      )}
      {(podeGerir || somenteLeitura) && indicadores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acompanhamento por responsável</CardTitle>
            <CardDescription>
              Decisões autônomas das operadoras, com supervisão e rastreabilidade gerencial.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {indicadores.map((indicador) => (
              <div key={indicador.usuario_id} className="rounded-md border p-3 text-sm">
                <p className="font-semibold">{indicador.nome}</p>
                <p className="mt-1 text-muted-foreground">
                  {indicador.assumidos} assumidos · {indicador.qualificados} qualificados ·{' '}
                  {indicador.desqualificados} desqualificados
                </p>
                <p className="text-muted-foreground">
                  Taxa: {indicador.taxa_qualificacao.toLocaleString('pt-BR')}% · Devoluções:{' '}
                  {indicador.devolvidos}
                </p>
                <p className="text-muted-foreground">
                  Tempo médio para assumir:{' '}
                  {indicador.tempo_medio_assumir_horas === null
                    ? '—'
                    : `${indicador.tempo_medio_assumir_horas.toLocaleString('pt-BR')} h`}
                </p>
                <p className="text-muted-foreground">
                  Tempo médio para decidir:{' '}
                  {indicador.tempo_medio_decidir_horas === null
                    ? '—'
                    : `${indicador.tempo_medio_decidir_horas.toLocaleString('pt-BR')} h`}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-48 w-full" />
          ))}
        </div>
      ) : error ? null : itens.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <SearchX className="h-9 w-9 text-muted-foreground" />
            <div>
              <p className="font-semibold">Nenhum prospect pendente</p>
              <p className="text-sm text-muted-foreground">A fila de qualificação está em dia.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {itens.map((item) => {
            const assumidaPorMim = item.responsavel_qualificacao?.id === usuarioId
            const podeDecidir = assumidaPorMim || podeGerir
            return (
              <Card key={item.id} className={commercialActionCardClass(item.proxima_acao_em)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{item.titulo}</CardTitle>
                      {item.external_id && (
                        <p className="mt-1 text-xs font-medium text-muted-foreground">
                          Negócio AC #{item.external_id}
                        </p>
                      )}
                      <CardDescription>
                        {item.empresa?.nome ?? 'Empresa não informada'}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">Qualificação pendente</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {item.descricao || 'Necessidade ainda sem descrição.'}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    <span>Origem: {item.origem_canal || 'não informada'}</span>
                    <span className="mx-2">•</span>
                    <span>
                      Qualificação:{' '}
                      {item.responsavel_qualificacao?.nome || 'disponível para assumir'}
                    </span>
                  </div>
                  <div className="rounded-md border bg-white/70 p-3 text-sm">
                    <p className="font-medium">{item.contato?.nome || 'Contato não informado'}</p>
                    <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" /> {item.contato?.email || 'E-mail não informado'}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />{' '}
                      {item.contato?.telefone || 'Telefone não informado'}
                    </p>
                  </div>
                  {!somenteLeitura && !item.responsavel_qualificacao && (
                    <Button
                      className="w-full gap-2"
                      variant="secondary"
                      disabled={assumindo === item.id}
                      onClick={() => void assumir(item)}
                    >
                      <UserCheck className="h-4 w-4" />
                      {assumindo === item.id ? 'Assumindo…' : 'Assumir qualificação'}
                    </Button>
                  )}
                  {podeGerir && (
                    <Select
                      value={item.responsavel_qualificacao?.id || ''}
                      onValueChange={(value) => void atribuir(item, value)}
                      disabled={assumindo === item.id}
                    >
                      <SelectTrigger aria-label="Responsável pela qualificação">
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
                      <Button className="flex-1 gap-2" onClick={() => abrir(item, 'qualificada')}>
                        <CheckCircle2 className="h-4 w-4" />
                        Qualificar
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 gap-2 text-rose-700"
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
