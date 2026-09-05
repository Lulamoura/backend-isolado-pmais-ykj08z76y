import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const listarFilaAtividades = vi.hoisted(() => vi.fn())
const listarSlas = vi.hoisted(() => vi.fn())
const listarOrdensExecucao = vi.hoisted(() => vi.fn())
const listarFechamentos = vi.hoisted(() => vi.fn())
const listarPropostasSemAbertura = vi.hoisted(() => vi.fn())
const useDashboardResumo = vi.hoisted(() => vi.fn())
const perfil = vi.hoisted(() => ({ slug: 'gestor-comercial' }))

vi.mock('@/services/atividades', () => ({ listarFilaAtividades }))
vi.mock('@/services/slas', () => ({ listarSlas }))
vi.mock('@/services/ordens-execucao', () => ({ listarOrdensExecucao }))
vi.mock('@/services/fechamentos', () => ({ listarFechamentos }))
vi.mock('@/services/propostas', () => ({ listarPropostasSemAbertura }))
vi.mock('@/hooks/use-dashboard', () => ({ useDashboardResumo }))
vi.mock('@/hooks/use-is-superadmin', () => ({
  useIsSuperAdmin: () => ({ perfilSlug: perfil.slug, loading: false, isSuperAdmin: false }),
}))

import OperacaoDia from '@/pages/OperacaoDia'

beforeEach(() => {
  vi.clearAllMocks()
  perfil.slug = 'gestor-comercial'
  listarFilaAtividades.mockResolvedValue({
    itens: [{ situacao: 'sem_proxima_acao' }, { situacao: 'vencida' }, { situacao: 'programada' }],
  })
  listarSlas.mockResolvedValue({
    itens: [{ situacao: 'vencido' }, { situacao: 'alerta' }, { situacao: 'no_prazo' }],
  })
  listarOrdensExecucao.mockResolvedValue({
    itens: [
      { estado_operacional: 'aguardando_oe' },
      { estado_operacional: 'em_processo_de_entrega' },
    ],
  })
  listarFechamentos.mockResolvedValue({
    itens: [{ agenda: { estado: 'ativa' } }, { agenda: null }],
  })
  listarPropostasSemAbertura.mockResolvedValue({ itens: [], limite_dias_uteis: 2 })
  useDashboardResumo.mockReturnValue({
    data: {
      escopo: 'proprios',
      resumo: {
        situacao: { ganhos: 2 },
        valores: {
          carteira_aberta_centavos: 350000,
          ganho_centavos: 120000,
          negocios_precificados: 4,
        },
        conversoes: {
          global_percentual: 40,
          qualitativa_percentual: 34.29,
          decisoes_valor_centavos: 350000,
        },
        modalidades: [
          { modalidade: 'recorrente', quantidade: 2, valor_centavos: 200000 },
          { modalidade: 'evento', quantidade: 1, valor_centavos: 100000 },
        ],
        ganhos_por_modalidade: [
          { modalidade: 'recorrente', quantidade: 1, valor_centavos: 70000 },
          { modalidade: 'serv_eventual', quantidade: 1, valor_centavos: 50000 },
        ],
      },
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
  })
})

describe('Operação do Dia', () => {
  it('consolida filas existentes sem simular leitura', async () => {
    render(
      <MemoryRouter>
        <OperacaoDia />
      </MemoryRouter>,
    )

    expect(await screen.findByText('1 sem data · 1 vencida(s) · 1 hoje')).toBeInTheDocument()
    expect(listarFilaAtividades).toHaveBeenCalledWith('todas', 'dia')
    expect(listarFechamentos).toHaveBeenCalledWith('acionavel')
    expect(screen.getByText('1 vencido(s) · 1 em alerta · prazo da etapa')).toBeInTheDocument()
    expect(listarSlas).toHaveBeenCalledWith('atencao')
    expect(screen.getByText('Propostas sem abertura')).toBeInTheDocument()
    expect(screen.getByText(/prazo de atenção é de 2 dias úteis/)).toBeInTheDocument()
    expect(screen.queryByText('Leitura de propostas: Não rastreável')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ganhos aguardando OE/ })).toHaveAttribute(
      'href',
      '/ordens-execucao?estado=aguardando_oe',
    )
  })

  it('preserva os resumos disponíveis se uma fila falhar', async () => {
    listarSlas.mockRejectedValueOnce(new Error('falha controlada'))
    render(
      <MemoryRouter>
        <OperacaoDia />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Resumo parcialmente disponível')).toBeInTheDocument()
    expect(screen.getByText('1 sem data · 1 vencida(s) · 1 hoje')).toBeInTheDocument()
  })

  it('não consulta nem apresenta ordens de execução ao perfil de negociação própria', async () => {
    perfil.slug = 'negociacao-propria'
    render(
      <MemoryRouter>
        <OperacaoDia />
      </MemoryRouter>,
    )

    expect(await screen.findByText('1 sem data · 1 vencida(s) · 1 hoje')).toBeInTheDocument()
    expect(listarOrdensExecucao).not.toHaveBeenCalled()
    expect(screen.queryByText('Ganhos aguardando OE')).not.toBeInTheDocument()
  })

  it('mostra indicadores primários com as fórmulas e o escopo do dashboard', async () => {
    render(
      <MemoryRouter>
        <OperacaoDia />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Indicadores primários')).toBeInTheDocument()
    const indicadores = screen.getByLabelText('Indicadores comerciais primários')
    expect(indicadores).toHaveTextContent('Carteira aberta')
    expect(indicadores).toHaveTextContent('R$ 3.500,00')
    expect(indicadores).toHaveTextContent('Negócios ganhos')
    expect(indicadores).toHaveTextContent('Conversão global')
    expect(indicadores).toHaveTextContent('40%')
    expect(indicadores).toHaveTextContent('Conversão qualitativa')
    expect(indicadores).toHaveTextContent('34,29%')
    expect(indicadores).toHaveTextContent('Negócios por modalidade')
    expect(indicadores).toHaveTextContent('Ganhos por modalidade')
    expect(indicadores).toHaveTextContent('0 · R$ 0,00')
    expect(useDashboardResumo).toHaveBeenCalledWith({
      inicio: expect.any(String),
      fim: expect.any(String),
    })
  })

  it('mostra todas as propostas sem abertura antes dos indicadores e sinaliza o tempo', async () => {
    listarPropostasSemAbertura.mockResolvedValueOnce({
      limite_dias_uteis: 2,
      itens: [
        {
          negocio_id: 'n-antigo',
          external_id: '4800',
          cliente: 'Cliente atrasado',
          data_envio: '2026-09-01T12:00:00Z',
          modalidade: 'recorrente',
          responsavel: 'Ana',
          dias_vida: 15,
          valor_centavos: 100000,
          dias_uteis_sem_abertura: 3,
          horas_corridas_sem_abertura: 72,
          classificacao_sem_abertura: 'atrasada',
        },
        {
          negocio_id: 'n-recente',
          external_id: '4821',
          cliente: 'Cliente recente',
          data_envio: '2026-09-05T00:00:00Z',
          modalidade: 'evento',
          responsavel: 'Bruno',
          dias_vida: 2,
          valor_centavos: 50000,
          dias_uteis_sem_abertura: 0,
          horas_corridas_sem_abertura: 3,
          classificacao_sem_abertura: 'recente',
        },
      ],
    })

    render(
      <MemoryRouter>
        <OperacaoDia />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Cliente atrasado')).toBeInTheDocument()
    expect(screen.getByText('3 dias úteis sem abertura')).toBeInTheDocument()
    expect(screen.getByText('Atrasada')).toBeInTheDocument()
    expect(screen.getByText('Enviada há 3 horas')).toBeInTheDocument()
    expect(screen.getByText('Recente')).toBeInTheDocument()
    const operacao = screen.getByText('Operação do Dia').closest('.space-y-6')!
    const texto = operacao.textContent ?? ''
    expect(texto.indexOf('Propostas sem abertura')).toBeLessThan(
      texto.indexOf('Indicadores primários'),
    )
  })
})
