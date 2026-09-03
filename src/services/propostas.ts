import pb from '@/lib/pocketbase/client'
import type { CommercialContext } from '@/lib/commercial-context'

export type EventoProposta = 'preparar' | 'aprovar' | 'emitir' | 'visualizar' | 'decidir'
export interface ItemProposta {
  negocio: {
    id: string
    titulo: string
    etapa: string
    updated: string
    data_periodo: string | null
  }
  contexto: CommercialContext
  proposta: null | {
    id: string
    identificador: string
    versao_id: string
    numero: number
    estado: 'rascunho' | 'enviada' | 'aceita' | 'recusada' | 'cancelada'
    modalidade: 'recorrente' | 'evento' | 'serv_eventual'
    valor_total_centavos: number
    valor_mensal_centavos: number
    pdf_disponivel: boolean
    destinatario: string | null
    canal_envio: string | null
    updated: string
    aprovada: boolean
    visualizada: boolean
    aberta: boolean
    enviada_sistema: boolean
    primeiro_acesso_publicacao_em: string | null
    eventos: Array<{
      id: string
      tipo: string
      autor_id: string
      data_hora: string
    }>
  }
}
export interface ConfiguracaoPropostas {
  aprovacao_interna_obrigatoria: boolean
  identificacao_visitante_obrigatoria: boolean
  identificacao_visitante_updated: string
}
export const listarPropostas = () =>
  pb.send<{ itens: ItemProposta[]; configuracao: ConfiguracaoPropostas }>(
    '/backend/v1/propostas/fila',
    {
      method: 'GET',
    },
  )
export const registrarEventoProposta = (body: Record<string, unknown>) =>
  pb.send('/backend/v1/propostas/eventos', { method: 'POST', body })
export interface VersaoPropostaInterna {
  id: string
  numero: number
  estado: string
  arquivo_nome: string | null
  arquivo_sha256: string | null
  arquivo_bytes: number
  aprovacao_estado: string | null
  created: string
  updated: string
  eventos: Array<{
    id: string
    tipo: string
    autor_id: string
    data_hora: string
    justificativa: string | null
  }>
}
export interface EventoPublicoProposta {
  id: string
  publicacao_id: string
  tipo: string
  ocorrido_em: string
  visitante_nome: string | null
}
export interface TimelinePropostaInterna {
  proposta_id: string
  versoes: VersaoPropostaInterna[]
  total_acessos: number
  total_downloads: number
  decisao: 'pendente' | 'aceita' | 'recusada'
  decisao_motivo: string | null
  eventos_publicos: EventoPublicoProposta[]
  envios: Array<{
    id: string
    canal: string
    destinatario: string | null
    assunto: string | null
    estado: string
    provider_id: string | null
    erro_codigo: string | null
    enviado_em: string | null
    created: string
  }>
}
export const criarVersaoPdfProposta = (
  negocioId: string,
  updatedEsperado: string,
  arquivo: File,
) => {
  const body = new FormData()
  body.append('arquivo_pdf', arquivo)
  body.append('updated_esperado', updatedEsperado)
  body.append('command_idempotency_key', novaChaveProposta(negocioId, 'versao-pdf'))
  return pb.send(`/backend/v1/propostas/${negocioId}/versoes`, { method: 'POST', body })
}
export const obterTimelineProposta = (negocioId: string) =>
  pb.send<TimelinePropostaInterna>(`/backend/v1/propostas/${negocioId}/timeline`, { method: 'GET' })
export interface PublicacaoPropostaInterna {
  id: string
  versao_id: string
  token_prefix: string
  publicada_em: string
  expira_em: string
  estado: 'ativa' | 'expirada' | 'revogada'
}
export const publicarProposta = (negocioId: string, updatedEsperado: string) =>
  pb.send<{ token: string; expira_em: string; estado: string }>(
    `/backend/v1/propostas/${negocioId}/publicar`,
    {
      method: 'POST',
      body: {
        updated_esperado: updatedEsperado,
        command_idempotency_key: novaChaveProposta(negocioId, 'publicar'),
      },
    },
  )
export const revogarPublicacaoProposta = (negocioId: string) =>
  pb.send(`/backend/v1/propostas/${negocioId}/revogar`, {
    method: 'POST',
    body: { command_idempotency_key: novaChaveProposta(negocioId, 'revogar') },
  })
export const listarPublicacoesProposta = (negocioId: string) =>
  pb.send<{ itens: PublicacaoPropostaInterna[] }>(`/backend/v1/propostas/${negocioId}/publicacao`, {
    method: 'GET',
  })
export const enviarPropostaPorEmail = (
  negocioId: string,
  destinatario: string,
  linkPublico: string,
) =>
  pb.send(`/backend/v1/propostas/${negocioId}/enviar-email`, {
    method: 'POST',
    body: {
      destinatario,
      link_publico: linkPublico,
      command_idempotency_key: novaChaveProposta(negocioId, 'email'),
    },
  })
export const prepararPropostaWhatsApp = (
  negocioId: string,
  telefone: string,
  linkPublico: string,
) =>
  pb.send<{ mensagem: string; url_whatsapp: string }>(
    `/backend/v1/propostas/${negocioId}/preparar-whatsapp`,
    {
      method: 'POST',
      body: {
        telefone,
        link_publico: linkPublico,
        command_idempotency_key: novaChaveProposta(negocioId, 'whatsapp'),
      },
    },
  )
export const configurarIdentificacaoVisitante = (
  obrigatoria: boolean,
  updatedEsperado: string,
  justificativa: string,
) =>
  pb.send<{
    obrigatoria: boolean
    changed: boolean
    updated: string
    versao: number
  }>('/backend/v1/propostas/configuracao/identificacao', {
    method: 'POST',
    body: {
      obrigatoria,
      justificativa,
      updated_esperado: updatedEsperado,
      confirmation: 'ALTERAR IDENTIFICACAO DE VISITANTE',
      command_idempotency_key: `proposal-visitor-config-${Date.now()}-${crypto.randomUUID()}`,
    },
  })
export const novaChaveProposta = (id: string, tipo: string) =>
  `proposta:${tipo}:${id}:${Date.now()}:${crypto.randomUUID()}`
