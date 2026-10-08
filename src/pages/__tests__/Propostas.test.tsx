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

import Propostas, {
  garantirSaudacaoEmailProposta,
  removerMetalinguagemEmailProposta,
} from '@/pages/Propostas'
import type { ItemProposta } from '@/services/propostas'

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
    responsavel: { id: 'usr-1', name: 'Shirleide Andrade do Nascimento' },
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
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
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
        'Leitura breve: Brenda está reavaliando a terceirização atual da unidade de Prazeres. O envio deve conectar a proposta ao escopo solicitado e abrir espaço para entender quais melhorias ela considera essenciais. Segue rascunho editável para revisão antes do envio.\n\nAssunto: Proposta nº 493.26 | Porteiro para a AUTONUNES – Unidade Prazeres\n\nOlá, Brenda! Tudo bem?\n\nAcabei de enviar por e-mail uma proposta da PMais para o serviço solicitado e para sua análise.\n\nVocê pode consultar o detalhamento pelo link:\nhttps://comercial.pmaisservicos.com.br/p/CEEBtUumUGk2Inx0tX4zXzfQT8AIKnVRo8VLP7YKd4uzuHmxIv1-nNCNWCLC4EKH\n\nPara alinharmos a proposta às necessidades da AUTONUNES, gostaria de entender quais pontos do serviço atual você considera prioritários melhorar.',
      dicas_para_melhorar_notas: [],
      resposta_curta:
        'Segue rascunho editável para apresentar a proposta à Brenda, conectando o escopo à reavaliação do serviço.\n\nAssunto: Proposta nº 493.26 | Portaria — AUTONUNES Prazeres\n\nOlá, Brenda! Tudo bem?\n\nConforme sua solicitação, encaminho a proposta da PMais para o serviço de portaria.\n\nVocê pode consultar o detalhamento da proposta neste link:\nhttp://localhost:3000/p/token-proposta-segura\n\nApós sua avaliação, podemos combinar uma breve conversa?\n\nAtenciosamente,\nShirleide Andrade do Nascimento\nComercial | PMais',
      aviso: 'Sugestão gerada para revisão humana. Nenhuma mensagem foi enviada.',
      modelo: 'openai_chat',
      fallback: false,
    })
  })

  it('trata sugestão contendo somente saudação sem travar a interface', () => {
    expect(
      garantirSaudacaoEmailProposta(
        'Olá, Brenda. Tudo bem?\n\n',
        itemProposta as unknown as ItemProposta,
      ),
    ).toBe('Olá, Brenda. Tudo bem?')
  })

  it('preserva o texto quando a saudação e a primeira frase vêm na mesma linha', () => {
    expect(
      garantirSaudacaoEmailProposta(
        'Olá, Brenda. Acabei de encaminhar a proposta para sua análise.',
        itemProposta as unknown as ItemProposta,
      ),
    ).toBe('Olá, Brenda. Tudo bem?\n\nAcabei de encaminhar a proposta para sua análise.')
  })

  it.each([
    ['Olá, segue a proposta para sua análise.', 'Segue a proposta para sua análise.'],
    ['Bom dia, encaminho a proposta para sua análise.', 'Encaminho a proposta para sua análise.'],
    ['Olá, Brenda, acabei de encaminhar a proposta.', 'Acabei de encaminhar a proposta.'],
    ['Olá: encaminho a proposta para sua análise.', 'Encaminho a proposta para sua análise.'],
  ])('preserva conteúdo ambíguo após a saudação: %s', (entrada, conteudoEsperado) => {
    expect(garantirSaudacaoEmailProposta(entrada, itemProposta as unknown as ItemProposta)).toBe(
      `Olá, Brenda. Tudo bem?\n\n${conteudoEsperado}`,
    )
  })

  it.each([
    [
      'Acabei de enviar por e-mail uma proposta para sua análise.',
      'Encaminho uma proposta para sua análise.',
    ],
    ['Acabei de encaminhar por e-mail a proposta solicitada.', 'Encaminho a proposta solicitada.'],
    ['Encaminhei por e-mail a proposta solicitada.', 'Encaminho a proposta solicitada.'],
    ['Neste e-mail, encaminho a proposta solicitada.', 'Encaminho a proposta solicitada.'],
    ['Neste e-mail, apresento a proposta solicitada.', 'Apresento a proposta solicitada.'],
  ])('remove referência ao próprio canal do e-mail: %s', (entrada, esperado) => {
    expect(removerMetalinguagemEmailProposta(entrada)).toBe(esperado)
  })

  it('preenche assunto e corpo do e-mail de proposta com marcador de link e revisão humana', async () => {
    const user = userEvent.setup()
    render(<Propostas />)

    await user.click(await screen.findByRole('button', { name: /Lançar proposta/i }))
    await screen.findByText('Publicar e enviar')

    expect(screen.getByLabelText('Assunto')).toHaveValue(
      'Proposta PMais PROP-001 — Autonunes Chevrolet Prazeres',
    )
    expect(screen.getByLabelText('Mensagem')).toHaveValue()
    expect(
      String(
        screen.getByLabelText('Mensagem').getAttribute('value') ||
          (screen.getByLabelText('Mensagem') as HTMLTextAreaElement).value,
      ),
    ).toContain('[LINK_PROPOSTA]')

    await user.click(screen.getByRole('button', { name: /Preencher e-mail com Nexo/i }))

    await waitFor(() => expect(gerarAjudaNexoNegocio).toHaveBeenCalled())
    expect(publicarProposta).not.toHaveBeenCalled()
    expect(obterContextoNexoNegocio).toHaveBeenCalledWith('4792')
    expect(gerarAjudaNexoNegocio).toHaveBeenCalledWith(
      '4792',
      'email_envio_proposta',
      contextoNexo,
      expect.stringContaining('[LINK_PROPOSTA]'),
    )

    expect(screen.getByLabelText('Assunto')).toHaveValue(
      'Proposta PMais PROP-001 — Agentes de apoio 44h semanais | Autonunes Chevrolet Prazeres',
    )
    const mensagem = (screen.getByLabelText('Mensagem') as HTMLTextAreaElement).value
    expect(mensagem).toContain('Olá, Brenda. Tudo bem?')
    expect(mensagem).toContain(
      'Encaminho uma proposta da PMais para o serviço solicitado e para sua análise.',
    )
    expect(mensagem).not.toContain('Acabei de enviar por e-mail')
    expect(mensagem).toContain('[LINK_PROPOSTA]')
    expect(mensagem).toContain('pelo link:\n\n[LINK_PROPOSTA]\n\nPara alinharmos')
    expect(mensagem).toContain(
      'Atenciosamente,\nShirleide Andrade do Nascimento\nComercial | PMais',
    )
    expect(mensagem).not.toContain('Leitura breve')
    expect(mensagem).not.toContain('Segue rascunho editável')
    expect(mensagem).not.toContain('Assunto:')
    expect(mensagem).not.toContain('http://localhost:3000/p/token-proposta-segura')
    expect(mensagem).not.toContain(
      'https://comercial.pmaisservicos.com.br/p/CEEBtUumUGk2Inx0tX4zXzfQT8AIKnVRo8VLP7YKd4uzuHmxIv1-nNCNWCLC4EKH',
    )
    expect(enviarPropostaPorEmail).not.toHaveBeenCalled()
    expect(salvarMensagemEmailProposta).toHaveBeenCalledWith('neg-1', mensagem)
  })

  it('mantém o link em bloco próprio mesmo quando a sugestão o cola ao texto e à assinatura', async () => {
    gerarAjudaNexoNegocio.mockResolvedValueOnce({
      contrato: 'nexo_ajuda_comercial_v1',
      external_id: '4792',
      acao: 'email_envio_proposta',
      mensagem_sugerida:
        'Assunto: Proposta para análise\n\nOlá, Brenda. Tudo bem?\n\nConfira a proposta:[LINK_PROPOSTA]Atenciosamente,\nShirleide Andrade do Nascimento',
      resposta_curta: '',
      fallback: false,
    })
    const user = userEvent.setup()
    render(<Propostas />)

    await user.click(await screen.findByRole('button', { name: /Lançar proposta/i }))
    await user.click(screen.getByRole('button', { name: /Preencher e-mail com Nexo/i }))

    await waitFor(() => expect(salvarMensagemEmailProposta).toHaveBeenCalled())
    const mensagem = (screen.getByLabelText('Mensagem') as HTMLTextAreaElement).value
    expect(mensagem).toContain('Confira a proposta:\n\n[LINK_PROPOSTA]\n\nAtenciosamente,')
    expect(publicarProposta).not.toHaveBeenCalled()
    expect(enviarPropostaPorEmail).not.toHaveBeenCalled()
  })

  it('publica o link somente quando o operador confirma o envio do e-mail', async () => {
    const user = userEvent.setup()
    render(<Propostas />)

    await user.click(await screen.findByRole('button', { name: /Lançar proposta/i }))
    await user.click(screen.getByRole('button', { name: /Preencher e-mail com Nexo/i }))
    await waitFor(() => expect(salvarMensagemEmailProposta).toHaveBeenCalled())
    expect(publicarProposta).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /Publicar e enviar por e-mail/i }))

    await waitFor(() =>
      expect(enviarPropostaPorEmail).toHaveBeenCalledWith(
        'neg-1',
        expect.objectContaining({ corpo: expect.stringContaining('[LINK_PROPOSTA]') }),
        'http://localhost:3000/p/token-proposta-segura',
      ),
    )
    expect(publicarProposta).toHaveBeenCalledTimes(1)
  })

  it('publica sob demanda e troca o marcador ao copiar a mensagem para WhatsApp', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    render(<Propostas />)

    await user.click(await screen.findByRole('button', { name: /Lançar proposta/i }))
    await user.click(screen.getByRole('button', { name: /Preencher e-mail com Nexo/i }))
    await waitFor(() => expect(salvarMensagemEmailProposta).toHaveBeenCalled())
    expect(publicarProposta).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /Copiar mensagem para WhatsApp/i }))

    await waitFor(() => expect(writeText).toHaveBeenCalled())
    const mensagemCopiada = writeText.mock.calls.at(-1)?.[0]
    expect(mensagemCopiada).toContain('http://localhost:3000/p/token-proposta-segura')
    expect(mensagemCopiada).not.toContain('[LINK_PROPOSTA]')
    expect(publicarProposta).toHaveBeenCalledTimes(1)
    expect(enviarPropostaPorEmail).not.toHaveBeenCalled()
  })

  it('corrige assunto em caixa alta e acrescenta saudação quando a sugestão do Nexo vier seca', async () => {
    gerarAjudaNexoNegocio.mockResolvedValueOnce({
      contrato: 'nexo_ajuda_comercial_v1',
      external_id: '4792',
      acao: 'email_envio_proposta',
      mensagem_sugerida:
        'Assunto: Proposta comercial PMais — AGENTES DE APOIO 44H SEMANAIS\n\nOlá, equipe.\n\nEncaminho a proposta para sua análise.\n\nhttps://comercial.pmaisservicos.com.br/p/token-gerado',
      resposta_curta: '',
      fallback: false,
    })
    const user = userEvent.setup()
    render(<Propostas />)

    await user.click(await screen.findByRole('button', { name: /Lançar proposta/i }))
    await user.click(screen.getByRole('button', { name: /Preencher e-mail com Nexo/i }))

    await waitFor(() =>
      expect(screen.getByLabelText('Assunto')).toHaveValue(
        'Proposta PMais PROP-001 — Agentes de apoio 44h semanais | Autonunes Chevrolet Prazeres',
      ),
    )
    const mensagem = (screen.getByLabelText('Mensagem') as HTMLTextAreaElement).value
    expect(mensagem).toMatch(/^Olá, Brenda\. Tudo bem\?\n\n/)
    expect(mensagem).not.toContain('Olá, equipe')
    expect(mensagem).toContain('Encaminho a proposta para sua análise.')
    expect(mensagem).toContain('[LINK_PROPOSTA]')
    expect(enviarPropostaPorEmail).not.toHaveBeenCalled()
  })

  it('usa saudação neutra quando o contato contém marcador de nome não informado', async () => {
    listarPropostas.mockResolvedValueOnce({
      itens: [
        {
          ...itemProposta,
          contexto: {
            ...itemProposta.contexto,
            contato: { ...itemProposta.contexto.contato, nome: 'NÃO INFORMADO' },
          },
        },
      ],
      configuracao: {
        aprovacao_interna_obrigatoria: false,
        identificacao_visitante_obrigatoria: true,
        identificacao_visitante_updated: '2026-09-13 10:00:00.000Z',
      },
    })
    gerarAjudaNexoNegocio.mockResolvedValueOnce({
      contrato: 'nexo_ajuda_comercial_v1',
      external_id: '4792',
      acao: 'email_envio_proposta',
      mensagem_sugerida:
        'Assunto: Proposta para análise\n\nOlá, Não informado. Tudo bem?\n\nEncaminho a proposta para sua análise.\n\nhttps://comercial.pmaisservicos.com.br/p/token-gerado',
      resposta_curta: '',
      fallback: true,
    })
    const user = userEvent.setup()
    render(<Propostas />)

    await user.click(await screen.findByRole('button', { name: /Lançar proposta/i }))
    await user.click(screen.getByRole('button', { name: /Preencher e-mail com Nexo/i }))

    await waitFor(() =>
      expect(salvarMensagemEmailProposta).toHaveBeenCalledWith(
        'neg-1',
        expect.stringContaining('Encaminho a proposta para sua análise.'),
      ),
    )
    const mensagem = (screen.getByLabelText('Mensagem') as HTMLTextAreaElement).value
    expect(mensagem).toMatch(/^Olá\. Tudo bem\?\n\n/)
    expect(mensagem).not.toContain('Olá, Não')
    expect(mensagem).toContain('[LINK_PROPOSTA]')
    expect(enviarPropostaPorEmail).not.toHaveBeenCalled()
  })

  it('mantém a tela de propostas aberta quando o negócio não tem empresa vinculada', async () => {
    listarPropostas.mockResolvedValueOnce({
      itens: [
        {
          ...itemProposta,
          negocio: {
            ...itemProposta.negocio,
            id: 'neg-sem-empresa',
            titulo: 'Cliente sem empresa vinculada',
          },
          contexto: {
            ...itemProposta.contexto,
            empresa: null,
            external_id: null,
          },
        },
      ],
      configuracao: {
        aprovacao_interna_obrigatoria: false,
        identificacao_visitante_obrigatoria: true,
        identificacao_visitante_updated: '2026-09-13 10:00:00.000Z',
      },
    })

    render(<Propostas />)

    expect(await screen.findByText('Cliente sem empresa vinculada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lançar proposta/i })).toBeInTheDocument()
  })
})
