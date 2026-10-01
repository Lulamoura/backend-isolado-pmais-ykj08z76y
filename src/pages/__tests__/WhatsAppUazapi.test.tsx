import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const obterStatusWhatsAppUazapi = vi.hoisted(() => vi.fn())
const resolverAmbiguidadeWhatsApp = vi.hoisted(() => vi.fn())
const toastSuccess = vi.hoisted(() => vi.fn())

vi.mock('@/services/whatsapp-uazapi', () => ({
  obterStatusWhatsAppUazapi,
  resolverAmbiguidadeWhatsApp,
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: toastSuccess } }))

import WhatsAppUazapi from '@/pages/WhatsAppUazapi'

const payload = {
  ok: true,
  monitoramento_ok: false,
  fontes_indisponiveis: ['midias_pendentes'],
  provider: 'uazapi',
  endpoint: '/backend/v1/integracao/whatsapp/uazapi/segredo/webhook',
  secret_configured: true,
  modo: 'captura_passiva',
  automatic_send_allowed: false,
  ambiguidades_negocios_abertos: [
    {
      id: 'vinculo-interno-123',
      operador: 'Cristiane PMais',
      contato: 'Renata Araújo',
      empresa: 'Ciclo Ambiental',
      telefone: '558199999999',
      ultima_interacao: '2026-09-30 20:44:18.000Z',
      mensagens_recentes: [
        {
          direcao: 'recebida',
          autor: 'Renata Araújo',
          texto: 'Pode me atualizar sobre as propostas de limpeza e vigilância?',
          momento: '2026-09-30 20:40:00.000Z',
        },
        {
          direcao: 'enviada_operadora',
          autor: 'prod_probe',
          texto: 'Vou verificar as duas propostas.',
          momento: '2026-09-30 20:41:00.000Z',
        },
      ],
      negocios_candidatos: [
        {
          id: 'negocio-interno-limpeza',
          titulo: 'Limpeza e conservação',
          numero_comercial: '538',
          cliente: 'Ciclo Ambiental',
          responsavel: 'Cristiane PMais',
          etapa: 'negociacao',
          valor: 4580.91,
          atualizado_em: '2026-09-29 15:30:00.000Z',
        },
        {
          id: 'negocio-interno-vigilancia',
          titulo: 'Vigilância desarmada',
          numero_comercial: '539',
          cliente: 'Ciclo Ambiental',
          responsavel: 'Cristiane PMais',
          etapa: 'producao_proposta',
          valor: 10915.25,
          atualizado_em: '2026-09-29 16:00:00.000Z',
        },
      ],
    },
  ],
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

const payloadAtualizado = {
  ...payload,
  monitoramento_ok: true,
  fontes_indisponiveis: [],
  ambiguidades_negocios_abertos: [],
  counts: {
    ...payload.counts,
    vinculos_pendentes: 0,
    vinculos_ambiguos_negocio_aberto: 0,
  },
  qualidade_base: {
    ...payload.qualidade_base,
    mensagens_vinculadas_negocio: 10,
    vinculos_automaticos_negocio: 3,
    vinculos_ambiguos: 0,
    vinculos_ambiguos_negocio_aberto: 0,
    aproveitamento_nexo_percentual: 100,
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  obterStatusWhatsAppUazapi.mockResolvedValue(payload)
  resolverAmbiguidadeWhatsApp.mockResolvedValue({ ok: true })
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
    expect(
      screen.getByText('Alguns indicadores não puderam ser atualizados agora.'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByText('Mídias pendentes').parentElement as HTMLElement).getByText(/^0$/),
    ).toBeInTheDocument()

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
    expect(screen.queryByText('Sem envio automático')).not.toBeInTheDocument()
    expect(screen.queryByText('Dados parciais no monitoramento')).not.toBeInTheDocument()
  })

  it('zera apenas os indicadores dependentes das mensagens quando essa fonte falha', async () => {
    obterStatusWhatsAppUazapi.mockResolvedValue({
      ...payload,
      fontes_indisponiveis: ['mensagens_qualidade'],
      qualidade_base: {
        ...payload.qualidade_base,
        vinculos_ambiguos_negocio_aberto: 2,
        sinais_comerciais_iniciais: {
          possivel_proposta: 2,
          audio_pendente: 3,
        },
      },
    })

    render(<WhatsAppUazapi />)

    expect(
      await screen.findByText('A leitura da base não pôde ser atualizada agora.'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByText('Mensagens avaliadas').parentElement as HTMLElement).getByText(/^0$/),
    ).toBeInTheDocument()
    expect(
      within(
        screen.getByText('Conversas ligadas a negócio').parentElement as HTMLElement,
      ).getByText(/^0$/),
    ).toBeInTheDocument()
    expect(
      within(screen.getByText('Aproveitamento para o Nexo').parentElement as HTMLElement).getByText(
        /^0%$/,
      ),
    ).toBeInTheDocument()
    expect(
      within(screen.getByText('Ambiguidades abertas').parentElement as HTMLElement).getByText(
        /^2$/,
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Indisponível')).not.toBeInTheDocument()
    expect(screen.getAllByText('Dados temporariamente indisponíveis.')).toHaveLength(2)
    expect(screen.getByText('Áudio ou mídia pendente').parentElement).toHaveTextContent('3')
    expect(screen.queryByText('Possível proposta, valor ou contrato')).not.toBeInTheDocument()
    expect(screen.queryByText('Ainda sem volume por operador comercial.')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Ainda sem negócios vinculados com conversas recentes.'),
    ).not.toBeInTheDocument()
  })

  it('preserva os indicadores válidos quando apenas a qualidade de mídias está indisponível', async () => {
    obterStatusWhatsAppUazapi.mockResolvedValue({
      ...payload,
      fontes_indisponiveis: ['midias_qualidade'],
      qualidade_base: {
        ...payload.qualidade_base,
        vinculos_ambiguos_negocio_aberto: 2,
        sinais_comerciais_iniciais: {
          possivel_proposta: 2,
          audio_pendente: 3,
        },
      },
    })

    render(<WhatsAppUazapi />)

    await screen.findByText('Alguns indicadores não puderam ser atualizados agora.')
    expect(
      within(screen.getByText('Mensagens avaliadas').parentElement as HTMLElement).getByText(/^8$/),
    ).toBeInTheDocument()
    expect(
      within(
        screen.getByText('Conversas ligadas a negócio').parentElement as HTMLElement,
      ).getByText(/^8$/),
    ).toBeInTheDocument()
    expect(
      within(screen.getByText('Aproveitamento para o Nexo').parentElement as HTMLElement).getByText(
        /^100%$/,
      ),
    ).toBeInTheDocument()
    expect(
      within(screen.getByText('Ambiguidades abertas').parentElement as HTMLElement).getByText(
        /^2$/,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Possível proposta, valor ou contrato').parentElement,
    ).toHaveTextContent('2')
    expect(screen.queryByText('Áudio ou mídia pendente')).not.toBeInTheDocument()
  })

  it('zera somente os indicadores dependentes dos vínculos quando essa fonte falha', async () => {
    obterStatusWhatsAppUazapi.mockResolvedValue({
      ...payload,
      fontes_indisponiveis: ['vinculos_qualidade'],
      qualidade_base: {
        ...payload.qualidade_base,
        vinculos_ambiguos_negocio_aberto: 2,
      },
    })

    render(<WhatsAppUazapi />)

    await screen.findByText('Alguns indicadores não puderam ser atualizados agora.')
    expect(
      within(screen.getByText('Mensagens avaliadas').parentElement as HTMLElement).getByText(/^8$/),
    ).toBeInTheDocument()
    expect(
      within(
        screen.getByText('Conversas ligadas a negócio').parentElement as HTMLElement,
      ).getByText(/^0$/),
    ).toBeInTheDocument()
    expect(
      within(screen.getByText('Aproveitamento para o Nexo').parentElement as HTMLElement).getByText(
        /^0%$/,
      ),
    ).toBeInTheDocument()
    expect(
      within(screen.getByText('Ambiguidades abertas').parentElement as HTMLElement).getByText(
        /^0$/,
      ),
    ).toBeInTheDocument()
  })

  it('mantém todos os contadores de saúde em zero quando suas fontes estão indisponíveis', async () => {
    obterStatusWhatsAppUazapi.mockResolvedValue({
      ...payload,
      fontes_indisponiveis: [
        'eventos_hoje',
        'mensagens_hoje',
        'midias_pendentes',
        'transcricoes_pendentes',
        'vinculos_pendentes',
      ],
    })

    render(<WhatsAppUazapi />)

    await screen.findByText('Alguns indicadores não puderam ser atualizados agora.')
    for (const rotulo of [
      'Eventos hoje',
      'Mensagens hoje',
      'Mídias pendentes',
      'Transcrições pendentes',
      'Vínculos pendentes',
    ]) {
      expect(
        within(screen.getByText(rotulo).parentElement as HTMLElement).getByText(/^0$/),
      ).toBeInTheDocument()
    }
    expect(screen.queryByText('Indisponível')).not.toBeInTheDocument()
  })

  it('permite analisar o contexto e vincular a conversa a vários negócios', async () => {
    obterStatusWhatsAppUazapi.mockReset()
    obterStatusWhatsAppUazapi
      .mockResolvedValueOnce(payload)
      .mockResolvedValueOnce(payloadAtualizado)
    render(<WhatsAppUazapi />)

    expect(
      await screen.findByRole('heading', { name: 'Ambiguidades para decisão' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Renata Araújo').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Ciclo Ambiental/).length).toBeGreaterThan(0)
    expect(
      screen.getByText('Pode me atualizar sobre as propostas de limpeza e vigilância?'),
    ).toBeInTheDocument()
    expect(screen.getByText('Limpeza e conservação')).toBeInTheDocument()
    expect(screen.getByText('Vigilância desarmada')).toBeInTheDocument()
    expect(screen.getByText('Nº do negócio: 538')).toBeInTheDocument()
    expect(screen.getByText('Nº do negócio: 539')).toBeInTheDocument()
    expect(screen.getAllByText('Cliente: Ciclo Ambiental')).toHaveLength(2)
    expect(screen.getAllByText('Responsável: Cristiane PMais')).toHaveLength(2)
    expect(screen.getByText(/R\$ 4\.580,91/)).toBeInTheDocument()
    expect(screen.getByText(/R\$ 10\.915,25/)).toBeInTheDocument()
    expect(screen.getByText(/30\/09\/2026 às 17:40/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: /Limpeza e conservação/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Vigilância desarmada/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar vínculo' }))

    await waitFor(() => {
      expect(resolverAmbiguidadeWhatsApp).toHaveBeenCalledWith('vinculo-interno-123', [
        'negocio-interno-limpeza',
        'negocio-interno-vigilancia',
      ])
    })
    expect(toastSuccess).toHaveBeenCalledWith('Vínculo confirmado.')
    expect(obterStatusWhatsAppUazapi).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('Nenhuma ambiguidade aguardando decisão.')).toBeInTheDocument()
    expect(screen.queryByText('vinculo-interno-123')).not.toBeInTheDocument()
    expect(screen.queryByText('negocio-interno-limpeza')).not.toBeInTheDocument()
    expect(screen.queryByText('negocio-interno-vigilancia')).not.toBeInTheDocument()
  })

  it('não apresenta fila vazia durante o carregamento inicial', () => {
    obterStatusWhatsAppUazapi.mockReturnValue(new Promise(() => {}))

    render(<WhatsAppUazapi />)

    expect(screen.getByText('Carregando ambiguidades...')).toBeInTheDocument()
    expect(screen.queryByText('Nenhuma ambiguidade aguardando decisão.')).not.toBeInTheDocument()
  })

  it('não mantém fila vazia ou cards antigos visíveis durante uma atualização manual', async () => {
    obterStatusWhatsAppUazapi.mockReset()
    obterStatusWhatsAppUazapi
      .mockResolvedValueOnce(payloadAtualizado)
      .mockReturnValueOnce(new Promise(() => {}))

    render(<WhatsAppUazapi />)
    expect(await screen.findByText('Nenhuma ambiguidade aguardando decisão.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))

    expect(screen.getByText('Carregando ambiguidades...')).toBeInTheDocument()
    expect(screen.queryByText('Nenhuma ambiguidade aguardando decisão.')).not.toBeInTheDocument()
    expect(screen.queryByText('Renata Araújo')).not.toBeInTheDocument()
  })

  it('explica e bloqueia uma seleção maior que o limite seguro da tela', async () => {
    obterStatusWhatsAppUazapi.mockResolvedValue({
      ...payload,
      ambiguidades_negocios_abertos: [
        {
          ...payload.ambiguidades_negocios_abertos[0],
          negocios_candidatos: [],
          selecao_indisponivel: true,
          total_candidatos: 81,
        },
      ],
    })

    render(<WhatsAppUazapi />)

    expect(
      await screen.findByText(/negócios demais para uma decisão segura nesta tela/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar vínculo' })).toBeDisabled()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('não apresenta fila vazia quando os detalhes das ambiguidades estão indisponíveis', async () => {
    obterStatusWhatsAppUazapi.mockResolvedValue({
      ...payload,
      ambiguidades_negocios_abertos: [],
      fontes_indisponiveis: ['detalhes_ambiguidades'],
    })

    render(<WhatsAppUazapi />)

    expect(
      await screen.findByText(/fila de ambiguidades está temporariamente indisponível/i),
    ).toBeInTheDocument()
    expect(screen.queryByText('Nenhuma ambiguidade aguardando decisão.')).not.toBeInTheDocument()
    expect(screen.queryByText('Dados parciais no monitoramento')).not.toBeInTheDocument()
  })
})
