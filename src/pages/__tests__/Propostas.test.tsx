import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listarPropostas = vi.hoisted(() => vi.fn())
const publicarProposta = vi.hoisted(() => vi.fn())
const salvarMensagemEmailProposta = vi.hoisted(() => vi.fn())
const enviarPropostaPorEmail = vi.hoisted(() => vi.fn())
const obterTimelineProposta = vi.hoisted(() => vi.fn())
const gerarAjudaNexoNegocio = vi.hoisted(() => vi.fn())
const obterContextoNexoNegocio = vi.hoisted(() => vi.fn())

vi.mock('@/services/propostas', () => ({
  listarPropostas,
  criarVersaoPdfProposta: vi.fn(),
  configurarIdentificacaoVisitante: vi.fn(),
  enviarPropostaPorEmail,
  novaChaveProposta: (id: string, tipo: string) => `test:${tipo}:${id}`,
  obterTimelineProposta,
  publicarProposta,
  revogarPublicacaoProposta: vi.fn(),
  registrarEventoProposta: vi.fn(),
  salvarMensagemEmailProposta,
}))
vi.mock('@/services/nexo', () => ({ obterContextoNexoNegocio, gerarAjudaNexoNegocio }))
vi.mock('@/services/qualificacoes', () => ({ devolverQualificacao: vi.fn() }))
vi.mock('@/hooks/use-is-superadmin', () => ({
  useIsSuperAdmin: () => ({ isSuperAdmin: false, perfilSlug: 'gestor-comercial', loading: false }),
}))
vi.mock('@/components/CommercialContextCard', () => ({
  CommercialContextCard: ({
    contexto,
  }: {
    contexto: { empresa?: { nome?: string | null } | null }
  }) => <div data-testid="commercial-context-card">{contexto.empresa?.nome}</div>,
}))
vi.mock('@/components/CommercialFilters', () => ({
  CommercialFilters: () => <div data-testid="commercial-filters" />,
}))
vi.mock('@/components/NexoBusinessActions', () => ({
  NexoBusinessActions: () => <div data-testid="nexo-business-actions" />,
}))
vi.mock('@/lib/pocketbase/client', () => ({
  default: { authStore: { record: { email: 'viviane@pmaisservicos.com.br' } } },
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import Propostas from '@/pages/Propostas'

const itemProposta = {
  negocio: {
    id: 'neg-1',
    titulo: 'Autonunes Chevrolet Prazeres',
    etapa: 'producao_proposta',
    updated: '2026-09-13 10:00:00.000Z',
    data_periodo: '2026-09-13',
  },
  contexto: {
    external_id: '4792',
    activecampaign_url: null,
    empresa: { id: 'emp-1', nome: 'Autonunes Chevrolet Prazeres' },
    contato: {
      id: 'cont-1',
      nome: 'Brenda',
      email: 'brenda@cliente.com.br',
      telefone: '81999990000',
    },
    responsavel: { id: 'usr-1', name: 'Viviane' },
    valor_centavos: 3690238,
    modalidade: 'recorrente',
    fase_crm: 'Proposta em produção',
    fonte_prospeccao: 'Comercial 06',
    proxima_acao_em: '2026-09-15 00:00:00.000Z',
    crm_created_at: '2026-09-10 00:00:00.000Z',
    crm_updated_at: '2026-09-12 00:00:00.000Z',
    origem_canal: null,
    somente_leitura: false,
  },
  proposta: {
    id: 'prop-1',
    identificador: 'PROP-001',
    versao_id: 'ver-1',
    numero: 2,
    estado: 'rascunho',
    modalidade: 'recorrente',
    valor_total_centavos: 3690238,
    valor_mensal_centavos: 3690238,
    pdf_disponivel: true,
    destinatario: 'brenda@cliente.com.br',
    canal_envio: null,
    updated: '2026-09-13 10:00:00.000Z',
    aprovada: false,
    visualizada: false,
    aberta: false,
    enviada_sistema: false,
    ultimo_envio_sistema_em: null,
    primeiro_acesso_publicacao_em: null,
    mensagem_email_rascunho: null,
    eventos: [],
  },
}

const contextoNexo = {
  contrato: 'nexo_contexto_negocio_v1',
  external_id: '4792',
  fontes: { negocio_local: true, proposta_aplicativo: true },
  negocio: { titulo: 'Autonunes Chevrolet Prazeres', fase_crm: 'Proposta em produção' },
  empresa: { nome: 'Autonunes Chevrolet Prazeres' },
  contato: { nome: 'Brenda', email: 'brenda@cliente.com.br' },
  campos_crm: {
    tipo_servico: 'Agentes de apoio 44h semanais',
    detalhamento_proposta: 'Cliente solicitou proposta para 06 lojas.',
  },
  notas_followups: [{ texto: 'Cliente aguarda análise da gestora de RH.' }],
}

describe('Propostas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    listarPropostas.mockResolvedValue({
      itens: [itemProposta],
      configuracao: {
        aprovacao_interna_obrigatoria: false,
        identificacao_visitante_obrigatoria: true,
        identificacao_visitante_updated: '2026-09-13 10:00:00.000Z',
      },
    })
    publicarProposta.mockResolvedValue({ token: 'token-proposta-segura', estado: 'ativa' })
    salvarMensagemEmailProposta.mockResolvedValue({ mensagem: 'ok', updated: '2026-09-13' })
    obterContextoNexoNegocio.mockResolvedValue(contextoNexo)
    gerarAjudaNexoNegocio.mockResolvedValue({
      contrato: 'nexo_ajuda_comercial_v1',
      external_id: '4792',
      acao: 'email_envio_proposta',
      diagnostico: '',
      perguntas_criticas: [],
      riscos: [],
      proximos_passos: [],
      mensagem_sugerida:
        'Segue rascunho editável para apresentar a proposta à Brenda, conectando o escopo à reavaliação do serviço.\n\nAssunto: Proposta nº 493.26 | Portaria — AUTONUNES Prazeres\n\nOlá, Brenda! Tudo bem?\n\nConforme sua solicitação, encaminho a proposta da PMais para o serviço de portaria.\n\nVocê pode consultar o detalhamento da proposta neste link:\nhttp://localhost:3000/p/token-proposta-segura\n\nApós sua avaliação, podemos combinar uma breve conversa?\n\nAtenciosamente,\nShirleide Andrade do Nascimento\nComercial | PMais',
      dicas_para_melhorar_notas: [],
      resposta_curta:
        'Segue rascunho editável para apresentar a proposta à Brenda, conectando o escopo à reavaliação do serviço.\n\nAssunto: Proposta nº 493.26 | Portaria — AUTONUNES Prazeres\n\nOlá, Brenda! Tudo bem?\n\nConforme sua solicitação, encaminho a proposta da PMais para o serviço de portaria.\n\nVocê pode consultar o detalhamento da proposta neste link:\nhttp://localhost:3000/p/token-proposta-segura\n\nApós sua avaliação, podemos combinar uma breve conversa?\n\nAtenciosamente,\nShirleide Andrade do Nascimento\nComercial | PMais',
      aviso: 'Sugestão gerada para revisão humana. Nenhuma mensagem foi enviada.',
      modelo: 'openai_chat',
      fallback: false,
    })
  })

  it('preenche assunto e corpo do e-mail de proposta com sugestão do Nexo, link real e revisão humana', async () => {
    const user = userEvent.setup()
    render(<Propostas />)

    await user.click(await screen.findByRole('button', { name: /Lançar proposta/i }))
    await screen.findByText('Publicar e enviar')

    expect(screen.getByLabelText('Assunto')).toHaveValue(
      'Proposta comercial PMais — Autonunes Chevrolet Prazeres',
    )
    expect(screen.getByLabelText('Mensagem')).toHaveValue()
    expect(
      String(
        screen.getByLabelText('Mensagem').getAttribute('value') ||
          (screen.getByLabelText('Mensagem') as HTMLTextAreaElement).value,
      ),
    ).toContain('[LINK_PROPOSTA]')

    await user.click(screen.getByRole('button', { name: /Preencher e-mail com Nexo/i }))

    await waitFor(() =>
      expect(publicarProposta).toHaveBeenCalledWith('neg-1', itemProposta.proposta.updated),
    )
    expect(obterContextoNexoNegocio).toHaveBeenCalledWith('4792')
    expect(gerarAjudaNexoNegocio).toHaveBeenCalledWith(
      '4792',
      'email_envio_proposta',
      contextoNexo,
      expect.stringContaining('http://localhost:3000/p/token-proposta-segura'),
    )

    expect(screen.getByLabelText('Assunto')).toHaveValue(
      'Proposta nº 493.26 | Portaria — AUTONUNES Prazeres',
    )
    const mensagem = (screen.getByLabelText('Mensagem') as HTMLTextAreaElement).value
    expect(mensagem).toContain('Olá, Brenda! Tudo bem?')
    expect(mensagem).toContain('Acesso a proposta')
    expect(mensagem).toContain('neste link:\n\nAcesso a proposta\n\nApós sua avaliação')
    expect(mensagem).not.toContain('Segue rascunho editável')
    expect(mensagem).not.toContain('Assunto:')
    expect(mensagem).not.toContain('http://localhost:3000/p/token-proposta-segura')
    expect(enviarPropostaPorEmail).not.toHaveBeenCalled()
    expect(salvarMensagemEmailProposta).toHaveBeenCalledWith('neg-1', mensagem)
  })
})
