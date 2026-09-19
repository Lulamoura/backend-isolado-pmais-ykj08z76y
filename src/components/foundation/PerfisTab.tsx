import { useState, useEffect } from 'react'
import { useRealtime } from '@/hooks/use-realtime'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import { getPerfis, createPerfil, updatePerfil } from '@/services/foundation'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Ban, CheckCircle } from 'lucide-react'
import type { RecordModel } from 'pocketbase'

export function PerfisTab() {
  const { user } = useAuth()
  const [records, setRecords] = useState<RecordModel[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RecordModel | null>(null)
  const [form, setForm] = useState({ nome: '', slug: '', descricao: '', ativo: true })
  const [errors, setErrors] = useState<FieldErrors>({})

  const load = async () => setRecords(await getPerfis())
  useEffect(() => {
    load()
  }, [])
  useRealtime('com_perfis', () => {
    load()
  })

  const openNew = () => {
    setEditing(null)
    setForm({ nome: '', slug: '', descricao: '', ativo: true })
    setErrors({})
    setOpen(true)
  }
  const openEdit = (r: RecordModel) => {
    setEditing(r)
    setForm({ nome: r.nome, slug: r.slug, descricao: r.descricao || '', ativo: r.ativo })
    setErrors({})
    setOpen(true)
  }

  const submit = async () => {
    setErrors({})
    try {
      if (editing) await updatePerfil(editing.id, form)
      else await createPerfil(form)
      setOpen(false)
    } catch (err) {
      setErrors(extractFieldErrors(err))
    }
  }

  const toggleAtivo = async (r: RecordModel) => {
    const action = r.ativo ? 'inativar' : 'ativar'
    if (!confirm(`Confirma ${action} este perfil?`)) return
    await updatePerfil(r.id, { ativo: !r.ativo })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Perfis de Acesso</h2>
          <p className="text-xs text-slate-500">
            Definição dos papéis e escopos operacionais no sistema
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openNew}
              size="sm"
              className="bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Perfil' : 'Novo Perfil'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
                {errors.nome && <p className="text-sm text-red-500">{errors.nome}</p>}
              </div>
              <div>
                <Label>Slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="ex: admin"
                />
                {errors.slug && <p className="text-sm text-red-500">{errors.slug}</p>}
              </div>
              <div>
                <Label>Descrição</Label>
                <Input
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.ativo}
                  onCheckedChange={(v) => setForm({ ...form, ativo: v })}
                />
                <Label>Ativo</Label>
              </div>
              <Button onClick={submit} className="w-full">
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/60">
            <TableRow className="border-slate-200/80">
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Nome
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Slug
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Ativo
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id} className="border-slate-100 hover:bg-slate-50/50">
                <TableCell className="font-medium text-slate-900">{r.nome}</TableCell>
                <TableCell className="text-slate-500 font-mono text-xs">{r.slug}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      r.ativo
                        ? 'border-emerald-200/60 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200/60 bg-slate-100 text-slate-600'
                    }`}
                  >
                    {r.ativo ? 'Sim' : 'Não'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(r)}
                    className="text-slate-600 hover:text-slate-900"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleAtivo(r)}
                    title={r.ativo ? 'Inativar' : 'Ativar'}
                    className="text-slate-600 hover:text-slate-900"
                  >
                    {r.ativo ? (
                      <Ban className="h-4 w-4 text-amber-500" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
