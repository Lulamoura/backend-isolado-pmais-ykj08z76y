import { useState, useEffect } from 'react'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'
import { createUser, updateUser } from '@/services/users'
import { getPerfis, getEquipes } from '@/services/foundation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { RecordModel } from 'pocketbase'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  editUser?: RecordModel | null
}

const EMPTY = {
  name: '',
  email: '',
  telefone: '',
  password: '',
  perfil_id: '',
  equipe_id: '',
  ativo_comercial: true,
}

export function UserForm({ open, onOpenChange, editUser }: Props) {
  const [perfis, setPerfis] = useState<RecordModel[]>([])
  const [equipes, setEquipes] = useState<RecordModel[]>([])
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const isEdit = !!editUser

  useEffect(() => {
    if (!open) return
    Promise.all([getPerfis(), getEquipes()]).then(([p, e]) => {
      setPerfis(p)
      setEquipes(e)
    })
    if (editUser) {
      setForm({
        name: editUser.name || '',
        email: editUser.email || '',
        telefone: editUser.telefone || '',
        password: '',
        perfil_id: editUser.perfil_id || '',
        equipe_id: editUser.equipe_id || '',
        ativo_comercial: editUser.ativo_comercial ?? true,
      })
    } else {
      setForm(EMPTY)
    }
    setErrors({})
    setFormError('')
  }, [open, editUser])

  const submit = async () => {
    setErrors({})
    setFormError('')
    setSaving(true)
    try {
      if (isEdit && editUser) {
        const saved = await updateUser(editUser.id, {
          name: form.name,
          email: form.email,
          telefone: form.telefone,
          perfil_id: form.perfil_id || undefined,
          equipe_id: form.equipe_id || undefined,
          ativo_comercial: form.ativo_comercial,
        })
        if (
          !saved?.id ||
          saved.name !== form.name.trim() ||
          saved.email !== form.email.trim().toLowerCase()
        ) {
          throw new Error('A alteração não foi confirmada pelo servidor.')
        }
      } else {
        const saved = await createUser({
          ...form,
          passwordConfirm: form.password,
        })
        if (
          !saved?.id ||
          saved.name !== form.name.trim() ||
          saved.email !== form.email.trim().toLowerCase()
        ) {
          throw new Error('O cadastro não foi confirmado pelo servidor.')
        }
      }
      onOpenChange(false)
    } catch (err) {
      setErrors(extractFieldErrors(err))
      setFormError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
          </div>
          <div>
            <Label>E-mail</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
          </div>
          <div>
            <Label>Telefone</Label>
            <Input
              type="tel"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="(81) 99999-9999"
            />
            {errors.telefone && <p className="text-sm text-red-500">{errors.telefone}</p>}
          </div>
          {!isEdit && (
            <div>
              <Label>Senha</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Mínimo 8 caracteres"
              />
              {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
            </div>
          )}
          <div>
            <Label>Perfil</Label>
            <Select
              value={form.perfil_id}
              onValueChange={(v) => setForm({ ...form, perfil_id: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um perfil" />
              </SelectTrigger>
              <SelectContent>
                {perfis.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.perfil_id && <p className="text-sm text-red-500">{errors.perfil_id}</p>}
          </div>
          <div>
            <Label>Equipe</Label>
            <Select
              value={form.equipe_id}
              onValueChange={(v) => setForm({ ...form, equipe_id: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma equipe" />
              </SelectTrigger>
              <SelectContent>
                {equipes.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.equipe_id && <p className="text-sm text-red-500">{errors.equipe_id}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.ativo_comercial}
              onCheckedChange={(v) => setForm({ ...form, ativo_comercial: v })}
            />
            <Label>Ativo Comercial</Label>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Button onClick={submit} className="w-full" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
