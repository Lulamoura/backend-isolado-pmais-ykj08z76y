import pb from '@/lib/pocketbase/client'
export interface NotaNegocio {
  id: string
  external_id: string
  texto: string
  autor_external_id: string | null
  autor_nome: string | null
  criada_em: string
  alterada_em: string | null
}
export const listarNotasNegocio = (negocioId: string) =>
  pb.send<{ total: number; itens: NotaNegocio[] }>(`/backend/v1/negocios/${negocioId}/notas`, {
    method: 'GET',
  })
