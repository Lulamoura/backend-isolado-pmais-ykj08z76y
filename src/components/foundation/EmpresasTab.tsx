import { useState, useEffect } from 'react'
import { useRealtime } from '@/hooks/use-realtime'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import { getEmpresas, createEmpresa, updateEmpresa } from '@/services/commercial'
import { getEquipes } from '@/services/foundation'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Plus, Pencil, Ban } from 'lucide-react'
import type { RecordModel } from 'pocketbase'

const STATUS_OPTIONS = ['ativo', 'inativo', 'prospecto'] as const

export function EmpresasTab() {
  const { user } = useAuth()
  const [records, setRecords] = useState<RecordModel[]>([])
  const [equipes, setEquipes] = useState<RecordModel[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RecordModel | null>(null)
  const [form, setForm] = useState<any>({
    nome: '',
    cnpj: '',
    email: '',
    telefone: '',
    status: 'prospecto',
    equipe_id: '',
    endereco: '',
    cidade: '',
    estado: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})

  const load = async () => {
    setRecords(await getEmpresas())
    setEquipes(await getEquipes())
  }
  useEffect(() => {
    load()
  }, [])
  useRealtime('com_empresas', () => {
    load()
  })

  const openNew = () => {
    setEditing(null)
    setForm({
      nome: '',
      cnpj: '',
      email: '',
      telefone: '',
      status: 'prospecto',
      equipe_id: '',
      endereco: '',
      cidade: '',
      estado: '',
    })
    setErrors({})
    setOpen(true)
  }
  const openEdit = (r: RecordModel) => {
    setEditing(r)
    setForm({
      nome: r.nome,
      cnpj: r.cnpj || '',
      email: r.email || '',
      telefone: r.telefone || '',
      status: r.status,
      equipe_id: r.equipe_id || '',
      endereco: r.endereco || '',
      cidade: r.cidade || '',
      estado: r.estado || '',
    })
    setErrors({})
    setOpen(true)
  }

  const submit = async () => {
    setErrors({})
    try {
      const data = { ...form, responsavel_id: user?.id }
      if (editing) await updateEmpresa(editing.id, data)
      else await createEmpresa(data)
      setOpen(false)
    } catch (err) {
      setErrors(extractFieldErrors(err))
    }
  }

  const inactivate = async (r: RecordModel) => {
    if (!confirm('Confirma a inativação da empresa?')) return
    await updateEmpresa(r.id, { status: 'inativo' })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Empresas e Contas</h2>
          <p className="text-xs text-slate-500">
            Cadastro central de clientes corporativos e prospectos
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openNew}
              size="sm"
              className="bg-slate-900 text-white hover:bg-slate-800 shadow-sm font-medium"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>CNPJ</Label>
                  <Input
                    value={form.cnpj}
                    onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>E-mail</Label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                  {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  />
                </div>
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
              </div>
              <div>
                <Label>Endereço</Label>
                <Input
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cidade</Label>
                  <Input
                    value={form.cidade}
                    onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Input
                    value={form.estado}
                    maxLength={2}
                    onChange={(e) => setForm({ ...form, estado: e.target.value })}
                  />
                </div>
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
                CNPJ
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Status
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
                <TableCell className="text-slate-500 font-mono text-xs">{r.cnpj || '-'}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      r.status === 'ativo'
                        ? 'border-emerald-200/60 bg-emerald-50 text-emerald-700'
                        : r.status === 'prospecto'
                          ? 'border-amber-200/60 bg-amber-50 text-amber-700'
                          : 'border-slate-200/60 bg-slate-100 text-slate-600'
                    }`}
                  >
                    {r.status}
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
                  {r.status !== 'inativo' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => inactivate(r)}
                      title="Inativar"
                      className="text-slate-600 hover:text-slate-900"
                    >
                      <Ban className="h-4 w-4 text-amber-500" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
