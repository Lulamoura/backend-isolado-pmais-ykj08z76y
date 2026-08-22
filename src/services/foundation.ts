import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export const getEquipes = (): Promise<RecordModel[]> =>
  pb.collection('com_equipes').getFullList({ sort: '-created' })
export const createEquipe = (data: Record<string, any>) => pb.collection('com_equipes').create(data)
export const updateEquipe = (id: string, data: Record<string, any>) =>
  pb.collection('com_equipes').update(id, data)
export const deleteEquipe = (id: string) => pb.collection('com_equipes').delete(id)

export const getPerfis = (): Promise<RecordModel[]> =>
  pb.collection('com_perfis').getFullList({ sort: '-created' })
export const createPerfil = (data: Record<string, any>) => pb.collection('com_perfis').create(data)
export const updatePerfil = (id: string, data: Record<string, any>) =>
  pb.collection('com_perfis').update(id, data)
export const deletePerfil = (id: string) => pb.collection('com_perfis').delete(id)

export const getPermissoes = (): Promise<RecordModel[]> =>
  pb.collection('com_permissoes').getFullList({ sort: '-created' })
export const createPermissao = (data: Record<string, any>) =>
  pb.collection('com_permissoes').create(data)
export const updatePermissao = (id: string, data: Record<string, any>) =>
  pb.collection('com_permissoes').update(id, data)
export const deletePermissao = (id: string) => pb.collection('com_permissoes').delete(id)

export const getPerfilPermissoes = (): Promise<RecordModel[]> =>
  pb
    .collection('com_perfil_permissoes')
    .getFullList({ expand: 'perfil_id,permissao_id', sort: '-created' })

export const getUsuariosEquipes = (): Promise<RecordModel[]> =>
  pb
    .collection('com_usuarios_equipes')
    .getFullList({ expand: 'usuario_id,equipe_id,perfil_id', sort: '-created' })
export const createUsuarioEquipe = (data: Record<string, any>) =>
  pb.collection('com_usuarios_equipes').create(data)
export const updateUsuarioEquipe = (id: string, data: Record<string, any>) =>
  pb.collection('com_usuarios_equipes').update(id, data)
export const deleteUsuarioEquipe = (id: string) => pb.collection('com_usuarios_equipes').delete(id)

export const getParametros = (): Promise<RecordModel[]> =>
  pb.collection('com_parametros').getFullList({ sort: '-created', expand: 'autor_id' })
export const createParametro = (data: Record<string, any>) =>
  pb.collection('com_parametros').create(data)
export const updateParametro = (id: string, data: Record<string, any>) =>
  pb.collection('com_parametros').update(id, data)
export const deleteParametro = (id: string) => pb.collection('com_parametros').delete(id)

export const getParametroVersoes = (parametroId: string): Promise<RecordModel[]> =>
  pb.collection('com_parametros_versoes').getFullList({
    filter: `parametro_id = "${parametroId}"`,
    sort: '-versao',
    expand: 'autor_id',
  })
