import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export const getEmpresas = (): Promise<RecordModel[]> =>
  pb
    .collection('com_empresas')
    .getFullList({ expand: 'equipe_id,responsavel_id', sort: '-created' })
export const createEmpresa = (data: Record<string, any>) =>
  pb.collection('com_empresas').create(data)
export const updateEmpresa = (id: string, data: Record<string, any>) =>
  pb.collection('com_empresas').update(id, data)
export const deleteEmpresa = (id: string) => pb.collection('com_empresas').delete(id)
export const getContatos = (): Promise<RecordModel[]> =>
  pb.collection('com_contatos').getFullList({ sort: 'nome' })

export const getNegocios = (): Promise<RecordModel[]> =>
  pb
    .collection('com_negocios')
    .getFullList({ expand: 'empresa_id,equipe_id,responsavel_id', sort: '-created' })
export const createNegocio = (data: Record<string, any>) =>
  pb.collection('com_negocios').create(data)
export const updateNegocio = (id: string, data: Record<string, any>) =>
  pb.collection('com_negocios').update(id, data)
export const deleteNegocio = (id: string) => pb.collection('com_negocios').delete(id)

export const changeNegocioResponsavel = (
  id: string,
  responsavelId: string,
  justificativa: string,
) =>
  pb.send(`/backend/v1/negocios/${id}/change-responsavel`, {
    method: 'POST',
    body: JSON.stringify({ responsavel_id: responsavelId, justificativa }),
    headers: { 'Content-Type': 'application/json' },
  })

export const getNegocioHistorico = (negocioId: string): Promise<RecordModel[]> =>
  pb.collection('com_negocio_historico').getFullList({
    filter: `negocio_id = "${negocioId}"`,
    sort: '-created',
    expand: 'usuario_id,responsavel_anterior_id,responsavel_novo_id',
  })

export const getDefaultEtapa = async (): Promise<string> => {
  try {
    const param = await pb
      .collection('com_parametros')
      .getFirstListItem('chave = "comercial.etapa_padrao" && ativo = true')
    return param.valor || 'prospects'
  } catch {
    return 'prospects'
  }
}
