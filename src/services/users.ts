import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export const getUsers = (): Promise<RecordModel[]> =>
  pb.collection('users').getFullList({ sort: 'name', expand: 'perfil_id,equipe_id' })

export const getActiveUsers = (): Promise<RecordModel[]> =>
  pb.collection('users').getFullList({ filter: 'ativo_comercial = true', sort: 'name' })

export const createUser = (data: {
  name: string
  email: string
  telefone?: string
  password: string
  passwordConfirm: string
  perfil_id?: string
  equipe_id?: string
  ativo_comercial?: boolean
}) =>
  pb.send('/backend/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })

export const updateUser = (
  id: string,
  data: {
    name?: string
    email?: string
    telefone?: string
    perfil_id?: string
    equipe_id?: string
    ativo_comercial?: boolean
  },
) =>
  pb.send(`/backend/v1/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })

export const changeOwnPassword = (_userId: string, oldPassword: string, newPassword: string) =>
  pb.send('/backend/v1/change-own-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
    headers: { 'Content-Type': 'application/json' },
  })

export const changeUserPassword = (userId: string, newPassword: string) =>
  pb.send('/backend/v1/change-user-password', {
    method: 'POST',
    body: JSON.stringify({ userId, newPassword }),
    headers: { 'Content-Type': 'application/json' },
  })
