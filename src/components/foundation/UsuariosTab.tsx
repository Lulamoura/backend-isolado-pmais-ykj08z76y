import { useState, useEffect } from 'react'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { getUsers } from '@/services/users'
import { getUsuariosEquipes } from '@/services/foundation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, KeyRound, Pencil } from 'lucide-react'
import { UserForm } from '@/components/foundation/UserForm'
import { ChangePasswordDialog } from '@/components/foundation/ChangePasswordDialog'
import type { RecordModel } from 'pocketbase'

export function UsuariosTab() {
  const { user } = useAuth()
  const [records, setRecords] = useState<RecordModel[]>([])
  const [userProfiles, setUserProfiles] = useState<Record<string, string[]>>({})
  const [showUserForm, setShowUserForm] = useState(false)
  const [editTarget, setEditTarget] = useState<RecordModel | null>(null)
  const [pwTarget, setPwTarget] = useState<{
    userId: string
    requireOld: boolean
    userName?: string
  } | null>(null)

  const load = async () => {
    const [users, vinculos] = await Promise.all([getUsers(), getUsuariosEquipes()])
    setRecords(users)
    const profileMap: Record<string, string[]> = {}
    for (const v of vinculos) {
      if (v.ativo !== false && v.expand?.perfil_id) {
        const userId = v.usuario_id
        if (!profileMap[userId]) profileMap[userId] = []
        const profileName = v.expand.perfil_id.nome
        if (!profileMap[userId].includes(profileName)) {
          profileMap[userId].push(profileName)
        }
      }
    }
    setUserProfiles(profileMap)
  }
  useEffect(() => {
    load()
  }, [])
  useRealtime('users', () => {
    load()
  })
  useRealtime('com_usuarios_equipes', () => {
    load()
  })

  const handleEdit = (record: RecordModel) => {
    setEditTarget(record)
    setShowUserForm(true)
  }

  const handleNewUser = () => {
    setEditTarget(null)
    setShowUserForm(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Usuários do Sistema</h2>
          <p className="text-xs text-slate-500">
            Operadores, gestores e administradores cadastrados
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm"
            onClick={() =>
              setPwTarget({ userId: user?.id, requireOld: true, userName: user?.name })
            }
          >
            <KeyRound className="h-4 w-4 mr-1 text-slate-500" />
            Alterar Minha Senha
          </Button>
          <Button
            size="sm"
            onClick={handleNewUser}
            className="bg-slate-900 text-white hover:bg-slate-800 shadow-sm font-medium"
          >
            <Plus className="h-4 w-4 mr-1" />
            Novo Usuário
          </Button>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/60">
            <TableRow className="border-slate-200/80">
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Nome
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                E-mail
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Telefone
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Perfis
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Equipe
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Ativo Comercial
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id} className="border-slate-100 hover:bg-slate-50/50">
                <TableCell className="font-medium text-slate-900">{r.name || '-'}</TableCell>
                <TableCell className="text-slate-500 text-xs">{r.email}</TableCell>
                <TableCell className="text-slate-500 text-xs">{r.telefone || '-'}</TableCell>
                <TableCell>
                  {userProfiles[r.id]?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {userProfiles[r.id].map((p, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="rounded-full border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                        >
                          {p}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
                <TableCell className="text-slate-600 text-xs">
                  {r.expand?.equipe_id?.nome || '-'}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      r.ativo_comercial
                        ? 'border-emerald-200/60 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200/60 bg-slate-100 text-slate-600'
                    }`}
                  >
                    {r.ativo_comercial ? 'Sim' : 'Não'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(r)}
                      title="Editar"
                      className="text-slate-600 hover:text-slate-900"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setPwTarget({
                          userId: r.id,
                          requireOld: r.id === user?.id,
                          userName: r.name || r.email,
                        })
                      }
                      title={r.id === user?.id ? 'Alterar Senha' : 'Resetar Senha'}
                      className="text-slate-600 hover:text-slate-900"
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <UserForm open={showUserForm} onOpenChange={setShowUserForm} editUser={editTarget} />

      {pwTarget && (
        <ChangePasswordDialog
          open={!!pwTarget}
          onOpenChange={(v) => {
            if (!v) setPwTarget(null)
          }}
          userId={pwTarget.userId}
          requireOldPassword={pwTarget.requireOld}
          userName={pwTarget.userName}
        />
      )}
    </div>
  )
}
