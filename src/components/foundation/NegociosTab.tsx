import { useState, useEffect } from 'react'
import { useRealtime } from '@/hooks/use-realtime'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import {
  getNegocios,
  getEmpresas,
  updateNegocio,
  changeNegocioResponsavel,
  getNegocioHistorico,
  getDefaultEtapa,
  getContatos,
} from '@/services/commercial'
import { criarOportunidade, mapEntradaError, novaChaveEntrada } from '@/services/entradas'
import { getEquipes } from '@/services/foundation'
import { getActiveUsers } from '@/services/users'
import { useAuth } from '@/hooks/use-auth'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'
import {
  ETAPA_OPTIONS,
  RESULTADO_OPTIONS,
  getEtapaLabel,
  getResultadoLabel,
} from '@/lib/status-labels'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Pencil, History, AlertTriangle, Ban, CheckCircle } from 'lucide-react'
import type { RecordModel } from 'pocketbase'

export function NegociosTab() {
  const { user } = useAuth()
  const { isSuperAdmin, loading: loadingSuperAdmin } = useIsSuperAdmin()
  const [records, setRecords] = useState<RecordModel[]>([])
  const [empresas, setEmpresas] = useState<RecordModel[]>([])
  const [equipes, setEquipes] = useState<RecordModel[]>([])
  const [activeUsers, setActiveUsers] = useState<RecordModel[]>([])
  const [contatos, setContatos] = useState<RecordModel[]>([])
  const [defaultEtapa, setDefaultEtapa] = useState('prospects')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RecordModel | null>(null)
  const [form, setForm] = useState<any>({
    titulo: '',
    empresa_id: '',
    equipe_id: '',
    responsavel_id: '',
    valor: 0,
    etapa: 'prospects',
    resultado: '',
    descricao: '',
    modo: 'pendente',
    contato_principal_id: '',
    origem_canal: '',
    modalidade: '',
    necessidade: '',
    localizacao: '',
    dimensao_estimada: '',
    prazo_cliente: '',
    proxima_acao: '',
    proxima_acao_em: '',
  })
  const [justificativa, setJustificativa] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [histOpen, setHistOpen] = useState(false)
  const [histRecords, setHistRecords] = useState<RecordModel[]>([])

  const load = async () => {
    const [neg, eq, au, em, co] = await Promise.all([
      getNegocios(),
      getEquipes(),
      getActiveUsers(),
      getEmpresas(),
      getContatos(),
    ])
    setRecords(neg)
    setEquipes(eq)
    setActiveUsers(au)
    setEmpresas(em)
    setContatos(co)
  }
  useEffect(() => {
    load()
    getDefaultEtapa().then(setDefaultEtapa)
  }, [])
  useRealtime('com_negocios', () => {
    load()
  })

  const orphans = records.filter((r) => r.etapa === 'prospects' && !r.responsavel_id && !r.inativo)

  const openNew = () => {
    setEditing(null)
    setForm({
      titulo: '',
      empresa_id: '',
      equipe_id: '',
      responsavel_id: user?.id || '',
      valor: 0,
      etapa: defaultEtapa,
      resultado: '',
      descricao: '',
      modo: 'pendente',
      contato_principal_id: '',
      origem_canal: '',
      modalidade: '',
      necessidade: '',
      localizacao: '',
      dimensao_estimada: '',
      prazo_cliente: '',
      proxima_acao: '',
      proxima_acao_em: '',
    })
    setJustificativa('')
    setErrors({})
    setOpen(true)
  }
  const openEdit = (r: RecordModel) => {
    setEditing(r)
    setForm({
      titulo: r.titulo,
      empresa_id: r.empresa_id || '',
      equipe_id: r.equipe_id || '',
      responsavel_id: r.responsavel_id || '',
      valor: r.valor || 0,
      etapa: r.etapa || '',
      resultado: r.resultado || '',
      descricao: r.descricao || '',
    })
    setJustificativa('')
    setErrors({})
    setOpen(true)
  }

  const submit = async () => {
    setErrors({})
    try {
      const data: any = { ...form, valor: Number(form.valor) || 0 }
      if (!data.etapa && !data.resultado) {
        data.etapa = defaultEtapa
      }
      if (editing) {
        const respChanged = editing.responsavel_id !== form.responsavel_id
        if (respChanged && form.responsavel_id) {
          if (!justificativa.trim()) {
            setErrors({ justificativa: 'Justificativa é obrigatória para troca de responsável.' })
            return
          }
          await changeNegocioResponsavel(editing.id, form.responsavel_id, justificativa)
          const { responsavel_id, ...rest } = data
          await updateNegocio(editing.id, rest)
        } else {
          await updateNegocio(editing.id, data)
        }
      } else {
        if (justificativa.trim().length < 20) {
          setErrors({
            justificativa:
              'Informe ao menos 20 caracteres explicando a contingência fora do ActiveCampaign.',
          })
          return
        }
        if (!confirm('Confirma a criação excepcional fora do ActiveCampaign?')) return
        await criarOportunidade({
          titulo: form.titulo,
          empresa_id: form.empresa_id,
          contato_principal_id: form.contato_principal_id || undefined,
          equipe_id: form.equipe_id || undefined,
          responsavel_id: form.responsavel_id,
          captador_id: user?.id,
          origem_canal: form.origem_canal,
          modo: form.modo,
          modalidade: form.modalidade || undefined,
          necessidade: form.necessidade || undefined,
          localizacao: form.localizacao || undefined,
          dimensao_estimada: form.dimensao_estimada || undefined,
          prazo_cliente: form.prazo_cliente || undefined,
          proxima_acao: form.proxima_acao || undefined,
          proxima_acao_em: form.proxima_acao_em || undefined,
          descricao: form.descricao || undefined,
          justificativa_contingencia: justificativa.trim(),
          confirmacao_contingencia: 'CRIAR FORA DO ACTIVECAMPAIGN',
          command_idempotency_key: novaChaveEntrada(),
        })
      }
      setOpen(false)
    } catch (err) {
      const fieldErrors = extractFieldErrors(err)
      setErrors(Object.keys(fieldErrors).length ? fieldErrors : { entrada: mapEntradaError(err) })
    }
  }

  const inactivate = async (r: RecordModel) => {
    if (!confirm('Confirma a inativação do negócio?')) return
    await updateNegocio(r.id, { inativo: true })
  }

  const activate = async (r: RecordModel) => {
    if (!confirm('Confirma a ativação do negócio?')) return
    await updateNegocio(r.id, { inativo: false })
  }

  const showHistory = async (negocioId: string) => {
    setHistRecords(await getNegocioHistorico(negocioId))
    setHistOpen(true)
  }

  const respChanged = editing && editing.responsavel_id !== form.responsavel_id

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Negócios</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          {isSuperAdmin && !loadingSuperAdmin ? (
            <DialogTrigger asChild>
              <Button onClick={openNew} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar em contingência
              </Button>
            </DialogTrigger>
          ) : null}
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Negócio' : 'Novo Negócio'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Título</Label>
                <Input
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                />
                {errors.titulo && <p className="text-sm text-red-500">{errors.titulo}</p>}
              </div>
              <div>
                <Label>Empresa</Label>
                <Select
                  value={form.empresa_id}
                  onValueChange={(v) => setForm({ ...form, empresa_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((em) => (
                      <SelectItem key={em.id} value={em.id}>
                        {em.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Label>Responsável</Label>
                <Select
                  value={form.responsavel_id}
                  onValueChange={(v) => setForm({ ...form, responsavel_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.responsavel_id && (
                  <p className="text-sm text-red-500">{errors.responsavel_id}</p>
                )}
              </div>
              {respChanged && (
                <div>
                  <Label>Justificativa da Troca de Responsável *</Label>
                  <Textarea
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                  />
                  {errors.justificativa && (
                    <p className="text-sm text-red-500">{errors.justificativa}</p>
                  )}
                </div>
              )}
              {editing && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Valor (R$)</Label>
                    <Input
                      type="number"
                      value={form.valor}
                      onChange={(e) => setForm({ ...form, valor: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Etapa</Label>
                    <Select
                      value={form.etapa || ''}
                      onValueChange={(v) => setForm({ ...form, etapa: v, resultado: '' })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {ETAPA_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {getEtapaLabel(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {editing && (
                <div>
                  <Label>Resultado</Label>
                  <Select
                    value={form.resultado || ''}
                    onValueChange={(v) => setForm({ ...form, resultado: v, etapa: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {RESULTADO_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {getResultadoLabel(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </div>
              {!editing && (
                <div className="space-y-3 rounded-md border p-3">
                  <div>
                    <Label>Modo de entrada</Label>
                    <Select value={form.modo} onValueChange={(v) => setForm({ ...form, modo: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Qualificação pendente</SelectItem>
                        <SelectItem value="pre_qualificada">Pré-qualificada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Origem / canal *</Label>
                    <Input
                      value={form.origem_canal}
                      onChange={(e) => setForm({ ...form, origem_canal: e.target.value })}
                    />
                  </div>
                  {form.modo === 'pre_qualificada' && (
                    <>
                      <div>
                        <Label>Contato estabelecido *</Label>
                        <Select
                          value={form.contato_principal_id}
                          onValueChange={(v) => setForm({ ...form, contato_principal_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {contatos.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.nome || c.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Modalidade *</Label>
                        <Select
                          value={form.modalidade}
                          onValueChange={(v) => setForm({ ...form, modalidade: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="recorrente">Recorrente</SelectItem>
                            <SelectItem value="evento">Evento</SelectItem>
                            <SelectItem value="serv_eventual">Serv. Eventual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Necessidade *</Label>
                        <Textarea
                          value={form.necessidade}
                          onChange={(e) => setForm({ ...form, necessidade: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Localização</Label>
                          <Input
                            value={form.localizacao}
                            onChange={(e) => setForm({ ...form, localizacao: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Dimensão estimada *</Label>
                          <Input
                            value={form.dimensao_estimada}
                            onChange={(e) =>
                              setForm({ ...form, dimensao_estimada: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Prazo do cliente *</Label>
                        <Input
                          type="date"
                          value={form.prazo_cliente}
                          onChange={(e) => setForm({ ...form, prazo_cliente: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Próxima ação *</Label>
                        <Textarea
                          value={form.proxima_acao}
                          onChange={(e) => setForm({ ...form, proxima_acao: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Data/hora da próxima ação *</Label>
                        <Input
                          type="datetime-local"
                          value={form.proxima_acao_em}
                          onChange={(e) => setForm({ ...form, proxima_acao_em: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
              {errors.entrada && <p className="text-sm text-red-500">{errors.entrada}</p>}
              {!editing && isSuperAdmin ? (
                <div>
                  <Label>Justificativa da contingência *</Label>
                  <Textarea
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    placeholder="Explique por que esta oportunidade não pôde nascer no ActiveCampaign."
                  />
                  {errors.justificativa && (
                    <p className="text-sm text-red-500">{errors.justificativa}</p>
                  )}
                </div>
              ) : null}
              <Button onClick={submit} className="w-full">
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {orphans.length > 0 && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Ocorrência crítica [TESTE]:</strong> {orphans.length} negócio(s) na etapa
            "Prospects" sem responsável atribuído.
          </AlertDescription>
        </Alert>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Etapa / Resultado</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r) => (
            <TableRow key={r.id} className={r.inativo ? 'opacity-50' : ''}>
              <TableCell className="font-medium">{r.titulo}</TableCell>
              <TableCell className="text-gray-500">{r.expand?.empresa_id?.nome || '-'}</TableCell>
              <TableCell className="text-gray-500">
                {r.expand?.responsavel_id?.name ||
                  (r.responsavel_id ? '—' : <Badge variant="destructive">Sem responsável</Badge>)}
              </TableCell>
              <TableCell className="text-gray-500">
                R$ {(r.valor || 0).toLocaleString('pt-BR')}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {r.etapa && <Badge variant="secondary">{getEtapaLabel(r.etapa)}</Badge>}
                  {r.resultado && (
                    <Badge variant={r.resultado === 'ganho' ? 'default' : 'outline'}>
                      {getResultadoLabel(r.resultado)}
                    </Badge>
                  )}
                  {r.inativo && (
                    <Badge variant="outline" className="ml-1">
                      Inativo
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => showHistory(r.id)}
                  title="Histórico"
                >
                  <History className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                {r.inativo ? (
                  <Button variant="ghost" size="sm" onClick={() => activate(r)} title="Ativar">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => inactivate(r)} title="Inativar">
                    <Ban className="h-4 w-4 text-amber-500" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={histOpen} onOpenChange={setHistOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico de Responsáveis</DialogTitle>
          </DialogHeader>
          {histRecords.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Nenhuma alteração de responsável registrada.
            </p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {histRecords.map((h) => (
                <div key={h.id} className="border rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="font-medium">
                      {h.expand?.responsavel_novo_id?.name || '—'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(h.created).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Anterior: {h.expand?.responsavel_anterior_id?.name || '—'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Por: {h.expand?.usuario_id?.name || h.expand?.usuario_id?.email || '—'}
                  </p>
                  <p className="text-xs italic">"{h.justificativa}"</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
