import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ArrowLeft, FileX, Loader2 } from 'lucide-react'

import { ajustarSubstituicao, mapSubstituicaoError } from '@/services/substituicoes'
import { useSubstituicaoView } from '@/hooks/use-substituicoes'
import { useToast } from '@/hooks/use-toast'
import { parseDateOnly } from '@/lib/date-only'
import { UserSelect } from '@/components/UserSelect'
import { NegocioSelect } from '@/components/NegocioSelect'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const ID_REGEX = /^[a-z0-9]{15}$/

type TipoCobertura = 'integral' | 'por_negocios'
type Motivo = 'ferias' | 'licenca' | 'falta'

function DatePickerField({
  value,
  onChange,
  placeholder,
}: {
  value?: Date
  onChange: (d?: Date) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start font-normal">
          {value ? format(value, 'dd/MM/yyyy') : (placeholder ?? 'Selecionar data')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            onChange(d)
            setOpen(false)
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export default function SubstituicaoAjuste() {
  const { id: rawId } = useParams<{ id: string }>()
  const idValido = rawId ? ID_REGEX.test(rawId) : false
  const id = idValido ? rawId : undefined
  const navigate = useNavigate()
  const { toast } = useToast()
  const { data, loading, error, notFound } = useSubstituicaoView(id)

  const [init, setInit] = useState(false)
  const [principalId, setPrincipalId] = useState<string | null>(null)
  const [reservaId, setReservaId] = useState<string | null>(null)
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined)
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined)
  const [negocios, setNegocios] = useState<string[]>([])
  const [observacao, setObservacao] = useState('')
  const [erros, setErros] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (data && !init) {
      setInit(true)
      setPrincipalId(data.substituto_principal?.id ?? null)
      setReservaId(data.substituto_reserva?.id ?? null)
      try {
        setDataInicio(parseDateOnly(data.data_inicio))
      } catch {
        setDataInicio(undefined)
      }
      try {
        setDataFim(parseDateOnly(data.data_fim))
      } catch {
        setDataFim(undefined)
      }
      setNegocios(data.negocios_cobertos.map((n) => n.id))
      setObservacao(data.observacao ?? '')
    }
  }, [data, init])

  const tipoCobertura: TipoCobertura = data?.tipo_cobertura ?? 'integral'
  const motivo: Motivo = data?.motivo ?? 'ferias'

  function validar(): string[] {
    const msgs: string[] = []
    if (dataInicio && dataFim && dataFim < dataInicio) {
      msgs.push('A data fim deve ser posterior à data início.')
    }
    if (reservaId && !principalId) {
      msgs.push('Substituto reserva exige um substituto principal.')
    }
    if (tipoCobertura === 'por_negocios' && principalId && negocios.length === 0) {
      msgs.push('Cobertura por negócios exige substituto principal e ao menos um negócio.')
    }
    if (tipoCobertura === 'integral' && principalId && negocios.length > 0) {
      msgs.push('Cobertura integral não deve ter negócios vinculados.')
    }
    if (!principalId) {
      if (tipoCobertura !== 'integral' || reservaId || negocios.length > 0) {
        msgs.push(
          'Sem substituto principal, a cobertura deve ser integral, sem reserva e sem negócios.',
        )
      }
    }
    if (data?.titular?.id && principalId && data.titular.id === principalId) {
      msgs.push('O titular não pode ser o próprio substituto principal.')
    }
    if (principalId && reservaId && principalId === reservaId) {
      msgs.push('O substituto principal e reserva não podem ser a mesma pessoa.')
    }
    return msgs
  }

  const handleSubmit = async () => {
    const msgs = validar()
    setErros(msgs)
    if (msgs.length > 0) return
    if (!data || !id) return
    setSubmitting(true)
    try {
      await ajustarSubstituicao({
        command_idempotency_key: crypto.randomUUID(),
        id,
        updated_esperado: data.updated,
        data_inicio: format(dataInicio as Date, 'yyyy-MM-dd'),
        data_fim: format(dataFim as Date, 'yyyy-MM-dd'),
        substituto_principal_id: principalId,
        substituto_reserva_id: reservaId,
        negocios_cobertos: tipoCobertura === 'por_negocios' ? negocios : [],
        observacao: observacao.trim() ? observacao.trim() : null,
      })
      toast({ title: 'Substituição ajustada com sucesso.' })
      navigate(`/substituicoes/${id}`)
    } catch (err) {
      toast({ title: mapSubstituicaoError(err), variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  // ID inválido → trata como não encontrado
  if (!idValido || notFound) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl space-y-6">
        <Link to="/substituicoes">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Voltar para substituições
          </Button>
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FileX className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Substituição não encontrada.</p>
            <Link to="/substituicoes">
              <Button variant="outline" size="sm">
                Voltar para lista
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl space-y-6">
      <div>
        {id && (
          <Link to={`/substituicoes/${id}`}>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Voltar para o detalhe
            </Button>
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight mt-2">Ajustar substituição</h1>
      </div>

      {loading && (
        <Card aria-busy="true">
          <p className="sr-only" role="status" aria-live="polite">
            Carregando dados da substituição
          </p>
          <CardHeader>
            <Skeleton className="h-6 w-[240px]" />
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Erro ao carregar</AlertTitle>
          <AlertDescription>Não foi possível carregar os dados.</AlertDescription>
        </Alert>
      )}

      {!loading && !error && data && (
        <Card>
          <CardHeader>
            <CardTitle>Dados da substituição</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Imutáveis */}
              <div className="space-y-1.5">
                <Label>Titular</Label>
                <Input value={data.titular?.name ?? '—'} readOnly disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de Cobertura</Label>
                <Select value={tipoCobertura} disabled>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="integral">Integral</SelectItem>
                    <SelectItem value="por_negocios">Por negócios</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Motivo</Label>
                <Select value={motivo} disabled>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ferias">Férias</SelectItem>
                    <SelectItem value="licenca">Licença</SelectItem>
                    <SelectItem value="falta">Falta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Editáveis */}
              <div className="space-y-1.5">
                <Label>Substituto Principal</Label>
                <UserSelect
                  value={principalId}
                  onChange={(v) => setPrincipalId(v)}
                  placeholder="Selecionar substituto principal"
                  ariaLabel="Selecionar substituto principal"
                  excludeId={data.titular?.id}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Substituto Reserva</Label>
                <UserSelect
                  value={reservaId}
                  onChange={(v) => setReservaId(v)}
                  placeholder="Selecionar substituto reserva"
                  ariaLabel="Selecionar substituto reserva"
                  excludeId={principalId ?? undefined}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data Início *</Label>
                <DatePickerField
                  value={dataInicio}
                  onChange={(d) => setDataInicio(d)}
                  placeholder="Selecionar data início"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Data Fim *</Label>
                <DatePickerField
                  value={dataFim}
                  onChange={(d) => setDataFim(d)}
                  placeholder="Selecionar data fim"
                />
              </div>
            </div>

            {tipoCobertura === 'por_negocios' && (
              <div className="space-y-1.5">
                <Label>Negócios *</Label>
                <NegocioSelect
                  value={negocios}
                  onChange={(ids) => setNegocios(ids)}
                  placeholder="Selecionar negócios"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Observação</Label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value.slice(0, 1000))}
                rows={3}
                maxLength={1000}
                placeholder="Observações adicionais (opcional)"
              />
              <p className="text-xs text-muted-foreground">{observacao.length}/1000</p>
            </div>

            {erros.length > 0 && (
              <div
                className="rounded-md border border-destructive/50 bg-destructive/5 p-3 space-y-1"
                role="alert"
                aria-live="assertive"
              >
                {erros.map((m, i) => (
                  <p key={i} className="text-sm text-destructive">
                    {m}
                  </p>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar ajustes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
