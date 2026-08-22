import { useState, useEffect } from 'react'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import { changeOwnPassword, changeUserPassword } from '@/services/users'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  userId: string
  requireOldPassword: boolean
  userName?: string
}

const EMPTY = { oldPassword: '', newPassword: '', confirmPassword: '' }

export function ChangePasswordDialog({
  open,
  onOpenChange,
  userId,
  requireOldPassword,
  userName,
}: Props) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(EMPTY)
    setErrors({})
    setSuccess(false)
  }, [open])

  const submit = async () => {
    setErrors({})
    setSuccess(false)

    if (form.newPassword.length < 8) {
      setErrors({ newPassword: 'A senha deve ter no mínimo 8 caracteres.' })
      return
    }
    if (form.newPassword !== form.confirmPassword) {
      setErrors({ confirmPassword: 'As senhas não coincidem.' })
      return
    }

    try {
      if (requireOldPassword) {
        await changeOwnPassword(userId, form.oldPassword, form.newPassword)
      } else {
        await changeUserPassword(userId, form.newPassword)
      }
      setSuccess(true)
      setForm(EMPTY)
    } catch (err) {
      setErrors(extractFieldErrors(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {requireOldPassword
              ? 'Alterar Minha Senha'
              : `Alterar Senha${userName ? ' — ' + userName : ''}`}
          </DialogTitle>
        </DialogHeader>
        {success && (
          <p className="text-sm text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400 rounded-md px-3 py-2">
            Senha alterada com sucesso.
          </p>
        )}
        <div className="space-y-3">
          {requireOldPassword && (
            <div>
              <Label>Senha Atual</Label>
              <Input
                type="password"
                value={form.oldPassword}
                onChange={(e) => setForm({ ...form, oldPassword: e.target.value })}
              />
              {errors.oldPassword && <p className="text-sm text-red-500">{errors.oldPassword}</p>}
            </div>
          )}
          <div>
            <Label>Nova Senha</Label>
            <Input
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              placeholder="Mínimo 8 caracteres"
            />
            {errors.newPassword && <p className="text-sm text-red-500">{errors.newPassword}</p>}
          </div>
          <div>
            <Label>Confirmar Nova Senha</Label>
            <Input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-red-500">{errors.confirmPassword}</p>
            )}
          </div>
          <Button onClick={submit} className="w-full">
            Alterar Senha
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
