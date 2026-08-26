import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const listarFilaAtividades = vi.hoisted(() => vi.fn())
const listarSlas = vi.hoisted(() => vi.fn())
const listarOrdensExecucao = vi.hoisted(() => vi.fn())
const listarFechamentos = vi.hoisted(() => vi.fn())
const perfil = vi.hoisted(() => ({ slug: 'gestor-comercial' }))

vi.mock('@/services/atividades', () => ({ listarFilaAtividades }))
vi.mock('@/services/slas', () => ({ listarSlas }))
vi.mock('@/services/ordens-execucao', () => ({ listarOrdensExecucao }))
vi.mock('@/services/fechamentos', () => ({ listarFechamentos }))
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
})

describe('Operação do Dia', () => {
  it('consolida filas existentes sem simular leitura', async () => {
    render(
      <MemoryRouter>
        <OperacaoDia />
      </MemoryRouter>,
    )

    expect(await screen.findByText('1 sem ação · 1 vencida(s)')).toBeInTheDocument()
    expect(screen.getByText('1 vencido(s) · 1 em alerta · prazo da etapa')).toBeInTheDocument()
    expect(listarSlas).toHaveBeenCalledWith('atencao')
    expect(screen.getByText('Leitura de propostas: Não rastreável')).toBeInTheDocument()
    expect(screen.getByText(/Nenhuma abertura será inferida ou simulada/)).toBeInTheDocument()
  })

  it('preserva os resumos disponíveis se uma fila falhar', async () => {
    listarSlas.mockRejectedValueOnce(new Error('falha controlada'))
    render(
      <MemoryRouter>
        <OperacaoDia />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Resumo parcialmente disponível')).toBeInTheDocument()
    expect(screen.getByText('1 sem ação · 1 vencida(s)')).toBeInTheDocument()
  })

  it('não consulta nem apresenta ordens de execução ao perfil de negociação própria', async () => {
    perfil.slug = 'negociacao-propria'
    render(
      <MemoryRouter>
        <OperacaoDia />
      </MemoryRouter>,
    )

    expect(await screen.findByText('1 sem ação · 1 vencida(s)')).toBeInTheDocument()
    expect(listarOrdensExecucao).not.toHaveBeenCalled()
    expect(screen.queryByText('Ganhos aguardando OE')).not.toBeInTheDocument()
  })
})
