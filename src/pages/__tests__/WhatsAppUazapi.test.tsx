import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const obterStatusWhatsAppUazapi = vi.hoisted(() => vi.fn())

vi.mock('@/services/whatsapp-uazapi', () => ({ obterStatusWhatsAppUazapi }))

import WhatsAppUazapi from '@/pages/WhatsAppUazapi'

const payload = {
  ok: true,
  monitoramento_ok: true,
  provider: 'uazapi',
  endpoint: '/backend/v1/integracao/whatsapp/uazapi/segredo/webhook',
  secret_configured: true,
  modo: 'captura_passiva',
  automatic_send_allowed: false,
  counts: {
    eventos_hoje: 10,
    mensagens_hoje: 8,
    midias_pendentes: 1,
    transcricoes_pendentes: 1,
    vinculos_pendentes: 0,
  },
  qualidade_base: {
    periodo: 'base completa disponível',
    total_mensagens_lidas: 8,
    total_vinculos_lidos: 2,
    mensagens_vinculadas_negocio: 8,
    vinculos_automaticos_negocio: 2,
    vinculos_pendentes_ou_sem_negocio: 0,
    vinculos_sem_contato: 0,
    vinculos_ambiguos: 0,
    vinculos_ambiguos_negocio_aberto: 0,
    midias_ou_audios_pendentes: 1,
    aproveitamento_nexo_percentual: 100,
    por_operador: [
      {
        chave: 'Cristiane PMais',
        label: 'Cristiane PMais',
        total_mensagens: 5,
        vinculadas_negocio: 5,
        pendentes_ou_sem_vinculo: 0,
        ambiguas: 0,
        ultima_interacao: '2026-09-30 20:44:18.000Z',
      },
      {
        chave: 'prod_probe',
        label: 'prod_probe',
        total_mensagens: 3,
        vinculadas_negocio: 0,
        pendentes_ou_sem_vinculo: 3,
        ambiguas: 0,
        ultima_interacao: '2026-09-30 20:44:18.000Z',
      },
    ],
    negocios_com_conversas_recentes: [
      {
        chave: 'negocio-interno-123',
        label: 'Proposta Qualificada',
        negocio_id: 'negocio-interno-123',
        negocio_label: 'Proposta Qualificada',
        empresa: 'Ciclo Ambiental',
        contato: 'Renata Araújo',
        operador: 'prod_probe',
        total_mensagens: 5,
        ultima_interacao: '2026-09-30 20:44:18.000Z',
      },
    ],
    sinais_comerciais_iniciais: { possivel_proposta: 2 },
    leitura: 'Base acompanhada.',
  },
  ultimo_webhook: {
    id: 'evento-interno-123',
    event_type: 'messages',
    instance_name: 'prod_probe',
    owner: '558100000000',
    message_id: 'mensagem-interna-123',
    status: 'recebido',
    received_at: '2026-09-30 20:44:18.000Z',
  },
  ultima_mensagem: {
    id: 'mensagem-interna-123',
    instance_name: 'Cristiane PMais',
    owner: '558100000000',
    chat_id: '558199999999@s.whatsapp.net',
    direcao: 'enviada_operadora',
    message_type: 'Conversation',
    status: 'capturada',
    received_at: '2026-09-30 20:44:18.000Z',
  },
  ultima_midia: {
    id: 'midia-interna-123',
    message_id: 'mensagem-interna-123',
    media_type: 'AudioMessage',
    download_status: 'pendente',
    transcricao_status: 'pendente_transcricao',
    received_at: '2026-09-30 20:44:18.000Z',
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  obterStatusWhatsAppUazapi.mockResolvedValue(payload)
})

describe('Integração WhatsApp — apresentação operacional', () => {
  it('exibe linguagem humana e datas de Recife sem dados técnicos', async () => {
    render(<WhatsAppUazapi />)

    expect((await screen.findAllByText('Cristiane PMais')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/30\/09\/2026 às 17:44/).length).toBeGreaterThan(0)
    expect(screen.getByText('Mensagem recebida')).toBeInTheDocument()
    expect(screen.getByText('Enviada pela equipe comercial')).toBeInTheDocument()
    expect(screen.getByText('Áudio')).toBeInTheDocument()
    expect(screen.getByText('Aguardando transcrição')).toBeInTheDocument()
    expect(screen.getByText('Proposta Qualificada')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByText(/prod_probe/)).not.toBeInTheDocument()
    })
    expect(screen.queryByText('negocio-interno-123')).not.toBeInTheDocument()
    expect(screen.queryByText('evento-interno-123')).not.toBeInTheDocument()
    expect(screen.queryByText('mensagem-interna-123')).not.toBeInTheDocument()
    expect(screen.queryByText('558199999999@s.whatsapp.net')).not.toBeInTheDocument()
    expect(screen.queryByText('2026-09-30 20:44:18.000Z')).not.toBeInTheDocument()
    expect(screen.queryByText('message_id')).not.toBeInTheDocument()
    expect(screen.queryByText('chat_id')).not.toBeInTheDocument()
    expect(screen.queryByText('event_type')).not.toBeInTheDocument()
  })
})
