import { useState, useEffect } from 'react'
import { useRealtime } from '@/hooks/use-realtime'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import {
  getUsuariosEquipes,
  createUsuarioEquipe,
  updateUsuarioEquipe,
  deleteUsuarioEquipe,
  getEquipes,
  getPerfis,
} from '@/services/foundation'
import { getUsers } from '@/services/users'
import { getEscopoLabel } from '@/lib/status-labels'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

const ESCOPO_OPTIONS = ['proprios', 'equipe', 'todos'] as const

export function VinculosTab() {
  const [records, setRecords] = useState<RecordModel[]>([])
  const [usuarios, setUsuarios] = useState<RecordModel[]>([])
  const [equipes, setEquipes] = useState<RecordModel[]>([])
  const [perfis, setPerfis] = useState<RecordModel[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RecordModel | null>(null)
  const [form, setForm] = useState<any>({
    usuario_id: '',
    equipe_id: '',
    perfil_id: '',
    escopo: 'proprios',
    ativo: true,
    inicio_vigencia: '',
    fim_vigencia: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})

  const load = async () => {
    const [v, u, eq, pe] = await Promise.all([
      getUsuariosEquipes(),
      getUsers(),
      getEquipes(),
      getPerfis(),
    ])
    setRecords(v)
    setUsuarios(u)
    setEquipes(eq)
    setPerfis(pe)
  }
  useEffect(() => {
    load()
  }, [])
  useRealtime('com_usuarios_equipes', () => {
    load()
  })

  const openNew = () => {
    setEditing(null)
    setForm({
      usuario_id: '',
      equipe_id: '',
      perfil_id: '',
      escopo: 'proprios',
      ativo: true,
      inicio_vigencia: '',
      fim_vigencia: '',
    })
    setErrors({})
    setOpen(true)
  }
  const openEdit = (r: RecordModel) => {
    setEditing(r)
    setForm({
      usuario_id: r.usuario_id || '',
      equipe_id: r.equipe_id || '',
      perfil_id: r.perfil_id || '',
      escopo: r.escopo,
      ativo: r.ativo !== false,
      inicio_vigencia: r.inicio_vigencia
        ? String(r.inicio_vigencia).split('T')[0].split(' ')[0]
        : '',
      fim_vigencia: r.fim_vigencia ? String(r.fim_vigencia).split('T')[0].split(' ')[0] : '',
    })
    setErrors({})
    setOpen(true)
  }

  const submit = async () => {
    setErrors({})
    try {
      if (editing) await updateUsuarioEquipe(editing.id, form)
      else await createUsuarioEquipe(form)
      setOpen(false)
    } catch (err) {
      setErrors(extractFieldErrors(err))
    }
  }
  const remove = async (id: string) => {
    if (confirm('Excluir este vínculo?')) await deleteUsuarioEquipe(id)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Vínculos</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Vínculo' : 'Novo Vínculo'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Usuário</Label>
                <Select
                  value={form.usuario_id}
                  onValueChange={(v) => setForm({ ...form, usuario_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {usuarios.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.usuario_id && <p className="text-sm text-red-500">{errors.usuario_id}</p>}
              </div>
              <div>
                <Label>Equipe</Label>
                <Select
                  value={form.equipe_id}
                  onValueChange={(v) => setForm({ ...form, equipe_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipes.map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.equipe_id && <p className="text-sm text-red-500">{errors.equipe_id}</p>}
              </div>
              <div>
                <Label>Perfil</Label>
                <Select
                  value={form.perfil_id}
                  onValueChange={(v) => setForm({ ...form, perfil_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
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
                <Label>Escopo</Label>
                <Select value={form.escopo} onValueChange={(v) => setForm({ ...form, escopo: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESCOPO_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {getEscopoLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead>Equipe</TableHead>
            <TableHead>Perfil</TableHead>
            <TableHead>Escopo</TableHead>
            <TableHead>Vigência</TableHead>
            <TableHead>Ativo</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">
                {r.expand?.usuario_id?.name || r.expand?.usuario_id?.email || '-'}
              </TableCell>
              <TableCell className="text-gray-500">{r.expand?.equipe_id?.nome || '-'}</TableCell>
              <TableCell className="text-gray-500">{r.expand?.perfil_id?.nome || '-'}</TableCell>
              <TableCell>
                <Badge variant="outline">{getEscopoLabel(r.escopo)}</Badge>
              </TableCell>
              <TableCell className="text-xs text-gray-500">
                {r.inicio_vigencia ? new Date(r.inicio_vigencia).toLocaleDateString('pt-BR') : '-'}
                {r.fim_vigencia ? ' — ' + new Date(r.fim_vigencia).toLocaleDateString('pt-BR') : ''}
              </TableCell>
              <TableCell>
                <Badge variant={r.ativo !== false ? 'default' : 'secondary'}>
                  {r.ativo !== false ? 'Sim' : 'Não'}
                </Badge>
              </TableCell>
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
