import { useState, useEffect } from 'react'
import { useRealtime } from '@/hooks/use-realtime'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import {
  getPermissoes,
  createPermissao,
  updatePermissao,
  deletePermissao,
} from '@/services/foundation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Plus, Pencil, Trash2 } from 'lucide-react'
import type { RecordModel } from 'pocketbase'

export function PermissoesTab() {
  const [records, setRecords] = useState<RecordModel[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RecordModel | null>(null)
  const [form, setForm] = useState({ nome: '', slug: '', recurso: '', acao: '', descricao: '' })
  const [errors, setErrors] = useState<FieldErrors>({})

  const load = async () => setRecords(await getPermissoes())
  useEffect(() => {
    load()
  }, [])
  useRealtime('com_permissoes', () => {
    load()
  })

  const openNew = () => {
    setEditing(null)
    setForm({ nome: '', slug: '', recurso: '', acao: '', descricao: '' })
    setErrors({})
    setOpen(true)
  }
  const openEdit = (r: RecordModel) => {
    setEditing(r)
    setForm({
      nome: r.nome,
      slug: r.slug,
      recurso: r.recurso,
      acao: r.acao,
      descricao: r.descricao || '',
    })
    setErrors({})
    setOpen(true)
  }

  const submit = async () => {
    setErrors({})
    try {
      if (editing) await updatePermissao(editing.id, form)
      else await createPermissao(form)
      setOpen(false)
    } catch (err) {
      setErrors(extractFieldErrors(err))
    }
  }
  const remove = async (id: string) => {
    if (
      confirm(
        'Excluir esta permissão? Esta ação só é permitida para permissões sem vínculos ativos [TESTE].',
      )
    )
      await deletePermissao(id)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Permissões</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Permissão' : 'Nova Permissão'}</DialogTitle>
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
                  placeholder="ex: empresas.view"
                />
                {errors.slug && <p className="text-sm text-red-500">{errors.slug}</p>}
              </div>
              <div>
                <Label>Recurso</Label>
                <Input
                  value={form.recurso}
                  onChange={(e) => setForm({ ...form, recurso: e.target.value })}
                  placeholder="ex: empresas"
                />
                {errors.recurso && <p className="text-sm text-red-500">{errors.recurso}</p>}
              </div>
              <div>
                <Label>Ação</Label>
                <Input
                  value={form.acao}
                  onChange={(e) => setForm({ ...form, acao: e.target.value })}
                  placeholder="ex: view"
                />
                {errors.acao && <p className="text-sm text-red-500">{errors.acao}</p>}
              </div>
              <div>
                <Label>Descrição</Label>
                <Input
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </div>
              <Button onClick={submit} className="w-full">
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Recurso</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.nome}</TableCell>
              <TableCell>
                <Badge variant="outline">{r.recurso}</Badge>
              </TableCell>
              <TableCell className="text-gray-500">{r.acao}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
