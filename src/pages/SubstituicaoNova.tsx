import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { criarSubstituicao, mapSubstituicaoError } from '@/services/substituicoes'
import { useToast } from '@/hooks/use-toast'
import { UserSelect } from '@/components/UserSelect'
import { NegocioSelect } from '@/components/NegocioSelect'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

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

interface FormState {
  titularId: string | null
  titularName: string | null
  principalId: string | null
  principalName: string | null
  reservaId: string | null
  reservaName: string | null
  dataInicio: Date | undefined
  dataFim: Date | undefined
  tipoCobertura: TipoCobertura
  negocios: string[]
  motivo: Motivo
  observacao: string
}

function validarForm(f: FormState): string[] {
  const msgs: string[] = []
  if (!f.titularId) msgs.push('Titular é obrigatório.')
  if (!f.dataInicio) msgs.push('Data de início é obrigatória.')
  if (!f.dataFim) msgs.push('Data de fim é obrigatória.')
  // I2
  if (f.dataInicio && f.dataFim && f.dataFim < f.dataInicio) {
    msgs.push('A data fim deve ser posterior à data início.')
  }
  // I3
  if (f.reservaId && !f.principalId) {
    msgs.push('Substituto reserva exige um substituto principal.')
  }
  // I4
  if (f.tipoCobertura === 'por_negocios' && f.principalId && f.negocios.length === 0) {
    msgs.push('Cobertura por negócios exige substituto principal e ao menos um negócio.')
  }
  // I5
  if (f.tipoCobertura === 'integral' && f.principalId && f.negocios.length > 0) {
    msgs.push('Cobertura integral não deve ter negócios vinculados.')
  }
  // I6
  if (!f.principalId) {
    if (f.tipoCobertura !== 'integral' || f.reservaId || f.negocios.length > 0) {
      msgs.push(
        'Sem substituto principal, a cobertura deve ser integral, sem reserva e sem negócios.',
      )
    }
  }
  // I7
  if (f.titularId && f.principalId && f.titularId === f.principalId) {
    msgs.push('O titular não pode ser o próprio substituto principal.')
  }
  // I8
  if (f.principalId && f.reservaId && f.principalId === f.reservaId) {
    msgs.push('O substituto principal e reserva não podem ser a mesma pessoa.')
  }
  return msgs
}

export default function SubstituicaoNova() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [form, setForm] = useState<FormState>({
    titularId: null,
    titularName: null,
    principalId: null,
    principalName: null,
    reservaId: null,
    reservaName: null,
    dataInicio: undefined,
    dataFim: undefined,
    tipoCobertura: 'integral',
    negocios: [],
    motivo: 'ferias',
    observacao: '',
  })
  const [erros, setErros] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Chaves de idempotência geradas uma única vez por intenção.
  // NÃO regeneradas após erro — somente em nova intenção (formulário resetado).
  const [idempotencyKeys] = useState(() => ({
    command: crypto.randomUUID(),
    creation: crypto.randomUUID(),
  }))

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  const handleCriarClick = () => {
    const msgs = validarForm(form)
    setErros(msgs)
    if (msgs.length === 0) setConfirmOpen(true)
  }

  const handleConfirmar = async () => {
    setSubmitting(true)
    try {
      const result = await criarSubstituicao({
        command_idempotency_key: idempotencyKeys.command,
        creation_idempotency_key: idempotencyKeys.creation,
        titular_id: form.titularId as string,
        substituto_principal_id: form.principalId,
        substituto_reserva_id: form.reservaId,
        data_inicio: format(form.dataInicio as Date, 'yyyy-MM-dd'),
        data_fim: format(form.dataFim as Date, 'yyyy-MM-dd'),
        tipo_cobertura: form.tipoCobertura,
        negocios_cobertos: form.tipoCobertura === 'por_negocios' ? form.negocios : [],
        motivo: form.motivo,
        observacao: form.observacao.trim() ? form.observacao.trim() : null,
      })
      toast({ title: 'Substituição criada com sucesso.' })
      navigate(`/substituicoes/${result.id}`)
    } catch (err) {
      toast({ title: mapSubstituicaoError(err), variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl space-y-6">
      <div>
        <Link to="/substituicoes">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Voltar para substituições
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mt-2">Nova substituição</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da substituição</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Titular *</Label>
              <UserSelect
                value={form.titularId}
                onChange={(id) => set('titularId', id)}
                onSelect={(opt) => set('titularName', opt ? opt.name : null)}
                placeholder="Selecionar titular"
                ariaLabel="Selecionar titular"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Substituto Principal</Label>
              <UserSelect
                value={form.principalId}
                onChange={(id) => set('principalId', id)}
                onSelect={(opt) => set('principalName', opt ? opt.name : null)}
                placeholder="Selecionar substituto principal"
                ariaLabel="Selecionar substituto principal"
                excludeId={form.titularId ?? undefined}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Substituto Reserva</Label>
              <UserSelect
                value={form.reservaId}
                onChange={(id) => set('reservaId', id)}
                onSelect={(opt) => set('reservaName', opt ? opt.name : null)}
                placeholder="Selecionar substituto reserva"
                ariaLabel="Selecionar substituto reserva"
                excludeId={form.principalId ?? undefined}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de Cobertura *</Label>
              <Select
                value={form.tipoCobertura}
                onValueChange={(v) => {
                  const tipo = v as TipoCobertura
                  setForm((prev) => ({
                    ...prev,
                    tipoCobertura: tipo,
                    negocios: tipo === 'integral' ? [] : prev.negocios,
                  }))
                }}
              >
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
              <Label>Data Início *</Label>
              <DatePickerField
                value={form.dataInicio}
                onChange={(d) => set('dataInicio', d)}
                placeholder="Selecionar data início"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data Fim *</Label>
              <DatePickerField
                value={form.dataFim}
                onChange={(d) => set('dataFim', d)}
                placeholder="Selecionar data fim"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Motivo *</Label>
              <Select value={form.motivo} onValueChange={(v) => set('motivo', v as Motivo)}>
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
          </div>

          {form.tipoCobertura === 'por_negocios' && (
            <div className="space-y-1.5">
              <Label>Negócios *</Label>
              <NegocioSelect
                value={form.negocios}
                onChange={(ids) => set('negocios', ids)}
                placeholder="Selecionar negócios"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea
              value={form.observacao}
              onChange={(e) => set('observacao', e.target.value.slice(0, 1000))}
              rows={3}
              maxLength={1000}
              placeholder="Observações adicionais (opcional)"
            />
            <p className="text-xs text-muted-foreground">{form.observacao.length}/1000</p>
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
            <Button onClick={handleCriarClick} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar substituição
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar criação</AlertDialogTitle>
            <AlertDialogDescription>Confirme os dados da substituição:</AlertDialogDescription>
          </AlertDialogHeader>
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Titular</dt>
              <dd className="font-medium text-right">
                {form.titularName ?? form.titularId ?? '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Período</dt>
              <dd className="font-medium text-right">
                {form.dataInicio ? format(form.dataInicio, 'dd/MM/yyyy') : '—'} a{' '}
                {form.dataFim ? format(form.dataFim, 'dd/MM/yyyy') : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Tipo de cobertura</dt>
              <dd className="font-medium text-right">
                {form.tipoCobertura === 'integral' ? 'Integral' : 'Por negócios'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Motivo</dt>
              <dd className="font-medium text-right">
                {form.motivo === 'ferias'
                  ? 'Férias'
                  : form.motivo === 'licenca'
                    ? 'Licença'
                    : 'Falta'}
              </dd>
            </div>
          </dl>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(e) => {
                e.preventDefault()
                handleConfirmar()
              }}
            >
              {submitting ? 'Criando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
