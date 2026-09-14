import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({
  user: { id: 'u1', name: 'Operadora Teste', ativo_comercial: true },
}))
const perfilState = vi.hoisted(() => ({ perfilSlug: 'gestor-comercial' as string | null }))
const listarResponsaveisCentralNexo = vi.hoisted(() => vi.fn())
const gerarAnaliseCentralNexo = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: authState.user, isAuthenticated: true, loading: false }),
}))

vi.mock('@/hooks/use-is-superadmin', () => ({
  useIsSuperAdmin: () => ({ isSuperAdmin: perfilState.perfilSlug === 'superadministrador', perfilSlug: perfilState.perfilSlug, loading: false }),
}))

vi.mock('@/services/nexo-central', () => ({
  listarResponsaveisCentralNexo,
  gerarAnaliseCentralNexo,
}))

import NexoAssistente from '@/pages/NexoAssistente'

const frentes = [
  'Recomendações do dia',
  'Negócios com risco de esfriamento',
  'Propostas sem retorno',
  'Notas ruins/incompletas',
  'Follow-ups atrasados ou mal definidos',
  'Aprendizados comerciais',
]

const respostaNexo = {
  contrato: 'nexo_central_operacional_v1',
  frente: 'propostas-sem-retorno',
  escopo: {
    tipo: 'responsavel',
    label: 'Escopo da análise: responsável selecionado — Viviane Marculino',
    responsavel_id: 'u2',
    responsavel_nome: 'Viviane Marculino',
    perfil_slug: 'gestor-comercial',
  },
  total_negocios: 2,
  analise: 'Leitura breve do Nexo.\n\nPriorize as propostas sem resposta objetiva.',
  agent_display: 'Agente Nexo',
  model_display: 'Gpt 5.5 Codex',
  modelo: 'gpt-5.5',
  itens: [
    {
      negocio_id: 'n1',
      external_id: '123',
      id_negocio: '123',
      titulo: 'Hospital Alpha',
      cliente: 'Hospital Alpha',
      contato: 'Brenda Cliente',
      responsavel: 'Viviane Marculino',
      detalhamento_proposta: 'PROP-123; sem abertura confirmada; etapa negociação; próxima ação 15/09/2026.',
      acao_sugerida: 'Confirmar recebimento da proposta do negócio 123 com Brenda Cliente.',
    },
  ],
  aviso: 'Sugestão gerada para revisão humana. Nenhuma mensagem foi enviada e nenhum negócio foi alterado.',
  provider: 'nexo_hermes',
  nexo_provider: 'openai_chat',
  fallback: false,
  second_brain: { used: true },
}

describe('NexoAssistente', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    perfilState.perfilSlug = 'gestor-comercial'
    authState.user = { id: 'u1', name: 'Operadora Teste', ativo_comercial: true }
    listarResponsaveisCentralNexo.mockResolvedValue([
      { id: 'u1', name: 'Operadora Teste' },
      { id: 'u2', name: 'Viviane Marculino' },
    ])
    gerarAnaliseCentralNexo.mockResolvedValue(respostaNexo)
  })

  it('exibe a Central operacional do Nexo com as seis frentes aprovadas', () => {
    render(<NexoAssistente />)

    expect(screen.getByRole('heading', { name: /Assistente Nexo/i })).toBeInTheDocument()
    expect(screen.getByText(/contexto real/i)).toBeInTheDocument()
    frentes.forEach((frente) => expect(screen.getAllByText(frente).length).toBeGreaterThan(0))
    expect(screen.queryByText('Prospect ou nova oportunidade')).not.toBeInTheDocument()
    expect(screen.queryByText('Gerar sugestão assistida')).not.toBeInTheDocument()
  })

  it('troca a leitura operacional conforme a frente escolhida', async () => {
    const user = userEvent.setup()
    render(<NexoAssistente />)

    expect(screen.getByText(/Consolida o que merece atenção hoje/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Propostas sem retorno/i }))

    expect(screen.getByText(/proposta recém-enviada/i)).toBeInTheDocument()
    expect(screen.getByText('A proposta foi aberta?')).toBeInTheDocument()
    expect(screen.getByText(/fila de propostas por urgência/i)).toBeInTheDocument()
  })

  it('permite perfil geral filtrar análise por responsável e processar com Nexo', async () => {
    const user = userEvent.setup()
    render(<NexoAssistente />)

    await waitFor(() => expect(listarResponsaveisCentralNexo).toHaveBeenCalled())
    await user.selectOptions(screen.getByLabelText(/Filtrar por responsável/i), 'u2')
    await user.click(screen.getByRole('button', { name: /Propostas sem retorno/i }))
    await user.click(screen.getByRole('button', { name: /Gerar análise com Nexo/i }))

    await waitFor(() =>
      expect(gerarAnaliseCentralNexo).toHaveBeenCalledWith({
        frente: 'propostas-sem-retorno',
        responsavel_id: 'u2',
      }),
    )
    expect(await screen.findByText(/Resultado da análise do Nexo/i)).toBeInTheDocument()
    expect(screen.getByText('IA real')).toBeInTheDocument()
    expect(screen.getByText(/Provider: Agente Nexo/i)).toBeInTheDocument()
    expect(screen.getByText(/Modelo: Gpt 5.5 Codex/i)).toBeInTheDocument()
    expect(screen.queryByText(/provider: nexo_hermes/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/modelo: openai_chat/i)).not.toBeInTheDocument()
    expect(screen.getAllByText(/Hospital Alpha/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/ID do negócio: 123/i)).toBeInTheDocument()
    expect(screen.getByText(/Cliente: Hospital Alpha/i)).toBeInTheDocument()
    expect(screen.getByText(/Contato: Brenda Cliente/i)).toBeInTheDocument()
    expect(screen.getByText(/Responsável interno: Viviane Marculino/i)).toBeInTheDocument()
    expect(screen.getByText(/Detalhamento da proposta: PROP-123/i)).toBeInTheDocument()
    expect(screen.getByText(/15\/09\/2026/i)).toBeInTheDocument()
    expect(screen.queryByText(/2026-09-15/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Cliente: Hospital Alpha\. Contato:/i)).not.toBeInTheDocument()
  })

  it('restringe perfil comum aos próprios negócios e não mostra filtro de responsável', async () => {
    const user = userEvent.setup()
    perfilState.perfilSlug = 'operador-comercial'
    render(<NexoAssistente />)

    expect(screen.queryByLabelText(/Filtrar por responsável/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Escopo da análise: seus negócios/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Gerar análise com Nexo/i }))

    await waitFor(() =>
      expect(gerarAnaliseCentralNexo).toHaveBeenCalledWith({
        frente: 'recomendacoes-dia',
        responsavel_id: undefined,
      }),
    )
    expect(listarResponsaveisCentralNexo).not.toHaveBeenCalled()
  })

  it('mantém aviso discreto sem card dedicado de escopo seguro', async () => {
    const { container } = render(<NexoAssistente />)

    await waitFor(() => expect(listarResponsaveisCentralNexo).toHaveBeenCalled())
    expect(screen.queryByText(/Escopo seguro da análise/i)).not.toBeInTheDocument()
    expect(container.textContent).toMatch(/não envia mensagens/i)
    expect(container.textContent).toMatch(/não altera negócios/i)
    expect(screen.getByRole('button', { name: /Gerar análise com Nexo/i })).toBeEnabled()
  })
})
