import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import { createParametro, updateParametro } from '@/services/foundation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { RecordModel } from 'pocketbase'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: RecordModel | null
}

const EMPTY = {
  chave: '',
  valor: '',
  descricao: '',
  tipo: '',
  unidade: '',
  regra_validacao: '',
  ativo: true,
  inicio_vigencia: '',
  fim_vigencia: '',
  justificativa: '',
}

const toDateInput = (val: any) => (val ? String(val).split('T')[0].split(' ')[0] : '')

export function ParametroForm({ open, onOpenChange, editing }: Props) {
  const { user } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})

  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({
        chave: editing.chave,
        valor: editing.valor,
        descricao: editing.descricao || '',
        tipo: editing.tipo || '',
        unidade: editing.unidade || '',
        regra_validacao: editing.regra_validacao || '',
        ativo: editing.ativo,
        inicio_vigencia: toDateInput(editing.inicio_vigencia),
        fim_vigencia: toDateInput(editing.fim_vigencia),
        justificativa: '',
      })
    } else {
      setForm(EMPTY)
    }
    setErrors({})
  }, [open, editing])

  const submit = async () => {
    setErrors({})
    if (editing && !form.justificativa.trim()) {
      setErrors({ justificativa: 'Justificativa é obrigatória para alteração.' })
      return
    }
    try {
      const data = {
        ...form,
        autor_id: user?.id,
        data_hora: new Date().toISOString(),
      }
      if (editing) {
        await updateParametro(editing.id, data)
      } else {
        await createParametro({ ...data, versao: 1 })
      }
      onOpenChange(false)
    } catch (err) {
      setErrors(extractFieldErrors(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Parâmetro' : 'Novo Parâmetro'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Chave</Label>
            <Input
              value={form.chave}
              onChange={(e) => setForm({ ...form, chave: e.target.value })}
              placeholder="ex: sistema.nome"
              disabled={!!editing}
            />
            {errors.chave && <p className="text-sm text-red-500">{errors.chave}</p>}
          </div>
          <div>
            <Label>Valor</Label>
            <Input
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
            />
            {errors.valor && <p className="text-sm text-red-500">{errors.valor}</p>}
          </div>
          <div>
            <Label>Descrição</Label>
            <Input
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Input
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                placeholder="ex: numero, texto"
              />
            </div>
            <div>
              <Label>Unidade</Label>
              <Input
                value={form.unidade}
                onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                placeholder="ex: dias, horas"
              />
            </div>
          </div>
          <div>
            <Label>Regra de Validação</Label>
            <Input
              value={form.regra_validacao}
              onChange={(e) => setForm({ ...form, regra_validacao: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início Vigência</Label>
              <Input
                type="date"
                value={form.inicio_vigencia}
                onChange={(e) => setForm({ ...form, inicio_vigencia: e.target.value })}
              />
            </div>
            <div>
              <Label>Fim Vigência</Label>
              <Input
                type="date"
                value={form.fim_vigencia}
                onChange={(e) => setForm({ ...form, fim_vigencia: e.target.value })}
              />
            </div>
          </div>
          {editing && (
            <div>
              <Label>Justificativa da Alteração *</Label>
              <Textarea
                value={form.justificativa}
                onChange={(e) => setForm({ ...form, justificativa: e.target.value })}
              />
              {errors.justificativa && (
                <p className="text-sm text-red-500">{errors.justificativa}</p>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            <Label>Ativo</Label>
          </div>
          <Button onClick={submit} className="w-full">
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
