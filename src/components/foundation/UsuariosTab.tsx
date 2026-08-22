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
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Usuários</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setPwTarget({ userId: user?.id, requireOld: true, userName: user?.name })
            }
          >
            <KeyRound className="h-4 w-4 mr-1" />
            Alterar Minha Senha
          </Button>
          <Button size="sm" onClick={handleNewUser}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Usuário
          </Button>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Perfis</TableHead>
            <TableHead>Equipe</TableHead>
            <TableHead>Ativo Comercial</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.name || '-'}</TableCell>
              <TableCell className="text-gray-500">{r.email}</TableCell>
              <TableCell>
                {userProfiles[r.id]?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {userProfiles[r.id].map((p, i) => (
                      <Badge key={i} variant="outline">
                        {p}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </TableCell>
              <TableCell className="text-gray-500">{r.expand?.equipe_id?.nome || '-'}</TableCell>
              <TableCell>
                <Badge variant={r.ativo_comercial ? 'default' : 'secondary'}>
                  {r.ativo_comercial ? 'Sim' : 'Não'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(r)} title="Editar">
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
                    title="Alterar Senha"
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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
