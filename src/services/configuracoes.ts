import pb from '@/lib/pocketbase/client'

export interface ConfiguracaoBannerProposta {
  personalizado: boolean
  url: string
  arquivo_nome: string
  arquivo_bytes: number
  updated: string
}

export const obterBannerPropostaPublica = () =>
  pb.send<ConfiguracaoBannerProposta>('/backend/v1/configuracoes/proposta-banner', {
    method: 'GET',
  })

export const obterBannerPropostaAdmin = () =>
  pb.send<ConfiguracaoBannerProposta>('/backend/v1/admin/configuracoes/proposta-banner', {
    method: 'GET',
  })

export const salvarBannerProposta = (arquivo: File, justificativa: string) => {
  const body = new FormData()
  body.append('arquivo', arquivo)
  body.append('justificativa', justificativa)
  return pb.send<ConfiguracaoBannerProposta>('/backend/v1/admin/configuracoes/proposta-banner', {
    method: 'POST',
    body,
  })
}

export const restaurarBannerPropostaPadrao = (justificativa: string) =>
  pb.send<ConfiguracaoBannerProposta>('/backend/v1/admin/configuracoes/proposta-banner', {
    method: 'DELETE',
    body: { justificativa },
  })
