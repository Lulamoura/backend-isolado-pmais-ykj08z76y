import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

const useDashboardResumo = vi.hoisted(() => vi.fn())
const getEquipes = vi.hoisted(() => vi.fn())
const getUsers = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Spok Agente Digital' } }),
}))

vi.mock('@/hooks/use-dashboard', () => ({ useDashboardResumo }))
vi.mock('@/services/foundation', () => ({ getEquipes }))
vi.mock('@/services/users', () => ({ getUsers }))

import Index, { createDefaultDashboardPeriod } from '@/pages/Index'

const dashboardResponse = {
  periodo: {
    inicio: '2026-05-22',
    fim: '2026-08-19',
    data_civil: 'America/Recife',
    campo: 'created',
  },
  filtros: { equipe_id: null, responsavel_id: null, incluir_inativos: false },
  escopo: 'todos',
  resumo: {
    total: 7,
    situacao: { abertos: 5, ganhos: 1, perdidos: 1, desqualificados: 0 },
    qualificacao: { pendentes: 2, qualificadas: 4, desqualificadas: 1 },
    valores: {
      total_precificado_centavos: 300000,
      carteira_aberta_centavos: 200000,
      ganho_centavos: 100000,
      perdido_centavos: 0,
      negocios_precificados: 3,
      negocios_valor_zero: 3,
      negocios_marcador_um_centavo: 1,
      ticket_medio_precificado_centavos: 100000,
      ticket_medio_ganho_centavos: 100000,
    },
    conversoes: {
      global_percentual: 50,
      qualitativa_percentual: 66.67,
      decisoes_valor_centavos: 150000,
      qualificacao_percentual: 80,
      propostas_percentual: null,
      propostas_status: 'indisponivel_sem_evento_comprovado',
    },
    cobertura: {
      origem: { preenchidos: 0, total: 7, percentual: 0 },
      responsavel: { preenchidos: 5, total: 7, percentual: 71.43 },
      modalidade: {
        preenchidos: 0,
        total: 7,
        percentual: 0,
        status: 'indisponivel_no_modelo_canonico_atual',
      },
    },
    perdas_por_motivo: [{ motivo: 'Preço', quantidade: 1, valor_centavos: 50000 }],
  },
  avisos: ['Conversão de propostas permanece indisponível.'],
}

beforeEach(() => {
  vi.clearAllMocks()
  getEquipes.mockResolvedValue([
    { id: 'team1', nome: 'Equipe Recife', ativo: true },
    { id: 'team2', nome: 'Equipe inativa', ativo: false },
  ])
  getUsers.mockResolvedValue([
    { id: 'user1', name: 'Ana Gestora', ativo_comercial: true },
    { id: 'user2', name: 'Bruno Inativo', ativo_comercial: false },
  ])
  useDashboardResumo.mockReturnValue({
    data: dashboardResponse,
    loading: false,
    error: null,
    refresh: vi.fn(),
  })
})

describe('Dashboard V1', () => {
  it('calcula período padrão inclusivo de 90 dias na data civil de Recife', () => {
    expect(createDefaultDashboardPeriod(new Date('2026-08-19T12:00:00Z'))).toEqual({
      inicio: '2026-05-22',
      fim: '2026-08-19',
    })
  })

  it('exibe somente indicadores sustentados pelo resumo do backend', () => {
    render(<Index />)

    expect(
      screen.getByRole('heading', { name: 'Visão comercial de Spok Agente Digital' }),
    ).toBeInTheDocument()
    expect(screen.getByText('R$ 2.000,00')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('66,67%')).toBeInTheDocument()
    expect(screen.getByText('71,43%')).toBeInTheDocument()
    expect(screen.queryByText('Conversão de propostas', { exact: true })).not.toBeInTheDocument()
  })

  it('mostra os motivos das perdas sem misturar desqualificações', () => {
    render(<Index />)

    const perdas = screen.getByLabelText('Motivos das perdas comerciais')
    expect(within(perdas).getByText('Preço')).toBeInTheDocument()
    expect(within(perdas).getByText('R$ 500,00')).toBeInTheDocument()
  })

  it('aplica período personalizado somente após submissão', () => {
    render(<Index />)
    const inicio = screen.getByLabelText('Início')
    const fim = screen.getByLabelText('Fim')

    fireEvent.change(inicio, { target: { value: '2026-01-01' } })
    fireEvent.change(fim, { target: { value: '2026-06-30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar período' }))

    expect(useDashboardResumo).toHaveBeenLastCalledWith({ inicio: '2026-01-01', fim: '2026-06-30' })
  })

  it('aplica e limpa filtros de equipe, responsável e negócios inativos', async () => {
    render(<Index />)

    fireEvent.click(await screen.findByRole('combobox', { name: 'Equipe' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Equipe Recife' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Responsável' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Bruno Inativo (inativo)' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Incluir negócios inativos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

    expect(useDashboardResumo).toHaveBeenLastCalledWith({
      inicio: expect.any(String),
      fim: expect.any(String),
      equipe_id: 'team1',
      responsavel_id: 'user2',
      incluir_inativos: true,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }))
    expect(useDashboardResumo).toHaveBeenLastCalledWith({
      inicio: expect.any(String),
      fim: expect.any(String),
    })
  })

  it('mantém o resumo disponível quando as opções de filtro falham', async () => {
    getEquipes.mockRejectedValueOnce(new Error('falha controlada'))
    render(<Index />)

    expect(
      await screen.findByText(/As opções de equipe e responsável não puderam ser carregadas/),
    ).toBeInTheDocument()
    expect(screen.getByText('Detalhamento comercial')).toBeInTheDocument()
  })

  it('detalha composição e qualificação sem inferir resultados', () => {
    render(<Index />)

    const composicao = screen.getByLabelText('Composição dos negócios')
    const qualificacao = screen.getByLabelText('Qualificação')

    expect(within(composicao).getByText('Perdidos')).toBeInTheDocument()
    expect(within(composicao).getByText('Desqualificados')).toBeInTheDocument()
    expect(within(qualificacao).getByText('Pendentes')).toBeInTheDocument()
    expect(within(qualificacao).getByText('Desqualificadas')).toBeInTheDocument()
  })

  it('exibe valores, tickets e qualidade cadastral retornados pelo backend', () => {
    render(<Index />)

    const valores = screen.getByLabelText('Valores e tickets')
    const qualidade = screen.getByLabelText('Qualidade dos dados')

    expect(within(valores).getByText('R$ 3.000,00')).toBeInTheDocument()
    expect(within(valores).getByText('Ticket médio ganho')).toBeInTheDocument()
    expect(within(qualidade).getByText('Cobertura de origem')).toBeInTheDocument()
    expect(within(qualidade).getByText('Marcadores de um centavo')).toBeInTheDocument()
  })

  it('mostra estado de carregamento acessível', () => {
    useDashboardResumo.mockReturnValue({ data: null, loading: true, error: null, refresh: vi.fn() })
    render(<Index />)

    expect(screen.getByLabelText('Carregando indicadores')).toBeInTheDocument()
  })

  it('mostra erro e permite nova tentativa', () => {
    const refresh = vi.fn()
    useDashboardResumo.mockReturnValue({
      data: null,
      loading: false,
      error: 'Falha controlada',
      refresh,
    })
    render(<Index />)

    expect(screen.getByText('Não foi possível carregar o dashboard')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
