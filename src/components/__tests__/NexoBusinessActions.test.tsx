import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const obterContextoNexoNegocio = vi.hoisted(() => vi.fn())

vi.mock('@/services/nexo', () => ({ obterContextoNexoNegocio }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { NexoBusinessActions } from '@/components/NexoBusinessActions'

const contexto = {
  contrato: 'nexo_contexto_negocio_v1',
  external_id: '4792',
  fontes: {
    negocio_local: true,
    activecampaign_deal: true,
    activecampaign_campos: true,
    activecampaign_notas: true,
    proposta_aplicativo: true,
  },
  negocio: {
    titulo: 'Proposta Qualificada',
    etapa: 'negociacao',
    fase_crm: 'Negociação',
    valor_centavos: 3690238,
    proxima_acao_em: '2026-09-15 00:00:00.000Z',
    fonte_prospeccao: 'Comercial 06',
  },
  empresa: { nome: 'Autonunes Chevrolet Prazeres' },
  contato: { nome: 'Brenda' },
  campos_crm: {
    tipo_servico: 'Agentes de Apoio 44h semanais',
    descricao_negocio: '',
    detalhamento_proposta: 'Cliente solicitou proposta de agentes de apoio para 06 lojas.',
  },
  proposta: {
    id: 'vyfivus2xl6yx4o',
    identificador: 'PROP-L0C1HJRLYLXE65L',
    status: 'ativa',
    versao_mais_recente: { numero: 2, valor_total_centavos: 3690238 },
  },
  notas_followups: [{ id: 'n1', texto: 'Cliente aguardando análise pela gestora de RH.' }],
}

describe('NexoBusinessActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    obterContextoNexoNegocio.mockResolvedValue(contexto)
  })

  it('exibe Ajuda do Nexo e carrega contexto quando o negócio está aberto', async () => {
    const user = userEvent.setup()
    render(
      <NexoBusinessActions externalId="4792" businessTitle="Proposta Qualificada" allowNexoHelp />,
    )

    await user.click(screen.getByRole('button', { name: /Ajuda do Nexo/i }))

    await waitFor(() => expect(obterContextoNexoNegocio).toHaveBeenCalledWith('4792'))
    expect(await screen.findByText('Sem envio automático')).toBeInTheDocument()
    expect(screen.getByText('Leitura comercial do Nexo')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Se o cliente informou que vai aguardar análise do RH, ele deu prazo ou data para essa análise?',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('A próxima ação cadastrada está alinhada com o prazo que o cliente forneceu?'),
    ).toBeInTheDocument()
    expect(screen.getByText('Dicas para melhorar notas')).toBeInTheDocument()
    expect(screen.getByText(/O histórico completo continua no botão Notas/i)).toBeInTheDocument()
    expect(screen.queryByText(/App: ok/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Cliente aguardando análise pela gestora de RH.')).not.toBeInTheDocument()
  })

  it('mantém Detalhamento da Proposta mesmo quando a ajuda do Nexo está oculta', async () => {
    const user = userEvent.setup()
    render(
      <NexoBusinessActions externalId="4792" businessTitle="Negócio ganho" allowNexoHelp={false} />,
    )

    expect(screen.queryByRole('button', { name: /Ajuda do Nexo/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Detalhamento da Proposta/i }))

    await waitFor(() => expect(obterContextoNexoNegocio).toHaveBeenCalledWith('4792'))
    expect(
      await screen.findByRole('dialog', { name: /Detalhamento da Proposta/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Agentes de Apoio 44h semanais')).toBeInTheDocument()
  })
})
