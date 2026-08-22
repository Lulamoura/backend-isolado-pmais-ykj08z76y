import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import type { SubstituicaoView } from '@/services/substituicoes'

// ─────────────────────────────────────────────────────────────────────
// Isolamento — todos os mocks declarados ANTES de qualquer import do SUT.
//
// 1) Mock do módulo PocketBase ANTES do SUT, reaproveitando o mock
//    existente em src/test/mocks/pocketbase.ts (factory async).
// ─────────────────────────────────────────────────────────────────────
vi.mock('@/lib/pocketbase/client', async () => {
  const mod = await import('@/test/mocks/pocketbase')
  return { default: mod.default }
})

// 2) Gate de feature-flags — MUTATIONS_ENABLED controlado via vi.hoisted.
//    O SUT importa MUTATIONS_ENABLED por nome; usamos um getter no factory
//    para que cada leitura (em cada render) reflita o valor corrente de
//    ffState, permitindo alternar o gate por teste.
const ffState = vi.hoisted(() => ({ MUTATIONS_ENABLED: true }))
vi.mock('@/lib/feature-flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/feature-flags')>()
  return {
    ...actual,
    get MUTATIONS_ENABLED() {
      return ffState.MUTATIONS_ENABLED
    },
    assertMutationsEnabled: vi.fn(),
  }
})

// 3) Mock de auth existente (src/test/mocks/auth.ts é .ts puro, sem JSX).
vi.mock('@/hooks/use-is-superadmin', async () => {
  const mod = await import('@/test/mocks/auth')
  return { useIsSuperAdmin: mod.useIsSuperAdmin }
})

// 4) Mock de react-router-dom. Inlinado (src/test/mocks/router.ts contém
//    JSX num arquivo .ts, o que o oxlint/tsc tratam como erro de parse).
const { _useParams, _useNavigate, _useSearchParams, _useLocation } = vi.hoisted(() => ({
  _useParams: vi.fn().mockReturnValue({}),
  _useNavigate: vi.fn().mockReturnValue(vi.fn()),
  _useSearchParams: vi.fn().mockReturnValue([new URLSearchParams(), vi.fn()]),
  _useLocation: vi.fn().mockReturnValue({ pathname: '/', search: '', hash: '', state: null }),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  const React = await import('react')
  // Link stub: renderiza children em um <a> sem exigir contexto de Router.
  const LinkStub = React.forwardRef<HTMLAnchorElement, { to?: string; children?: React.ReactNode }>(
    ({ to, children }, ref) => React.createElement('a', { href: to ?? '#', ref }, children),
  )
  LinkStub.displayName = 'LinkStub'
  return {
    ...actual,
    useNavigate: _useNavigate,
    useParams: _useParams,
    useSearchParams: _useSearchParams,
    useLocation: _useLocation,
    Link: LinkStub,
  }
})

// 5) Mock de obterSubstituicao / cancelarSubstituicao do serviço.
//    O SUT importa cancelarSubstituicao por nome (mutação) e indiretamente
//    obterSubstituicao via useSubstituicaoView (hook de leitura). Mantemos
//    ambos como vi.fn para inspecionar chamadas sem rede real.
const obterSubstituicaoMock = vi.hoisted(() => vi.fn())
const ajustarSubstituicaoMock = vi.hoisted(() => vi.fn())
const cancelarSubstituicaoMock = vi.hoisted(() => vi.fn())

vi.mock('@/services/substituicoes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/substituicoes')>()
  return {
    ...actual,
    obterSubstituicao: obterSubstituicaoMock,
    ajustarSubstituicao: ajustarSubstituicaoMock,
    cancelarSubstituicao: cancelarSubstituicaoMock,
  }
})

// Imports pós-mock.
import { MUTATIONS_ENABLED } from '@/lib/feature-flags'
import { pbSend, mockPbSend, ClientResponseError } from '@/test/mocks/pocketbase'
import { mockUseIsSuperAdmin } from '@/test/mocks/auth'
import SubstituicaoDetalhe from '@/pages/SubstituicaoDetalhe'

// ─────────────────────────────────────────────────────────────────────
// Fixture sintética — zero rede real.
// ─────────────────────────────────────────────────────────────────────
// ID com 15 chars [a-z0-9], satisfazendo ID_REGEX do SUT (requisito para
// que a página dispare a requisição de leitura via obterSubstituicao).
const VALID_ID = '1234567890abcde'

const FIXTURE_VIEW: SubstituicaoView = {
  id: VALID_ID,
  data_inicio: '2099-03-10T00:00:00.000Z',
  data_fim: '2099-03-20T00:00:00.000Z',
  tipo_cobertura: 'integral',
  motivo: 'ferias',
  cancelada_em: null,
  situacao: 'futura',
  titular: { id: 'titular00000001', name: 'Titular Fixtura' },
  substituto_principal: { id: 'principal0000001', name: 'Principal Fixtura' },
  substituto_reserva: null,
  negocios_cobertos: [],
  observacao: 'Observação de teste sintético.',
  justificativa_cancelamento: null,
  autor: null,
  created: '2025-01-01T00:00:00.000Z',
  updated: '2025-01-02T00:00:00.000Z',
}

describe('SubstituicaoDetalhe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ffState.MUTATIONS_ENABLED = true
    mockUseIsSuperAdmin({
      isSuperAdmin: true,
      perfilSlug: 'superadministrador',
      loading: false,
    })
    _useParams.mockReturnValue({ id: 'abc123' })
    // Por padrão, leitura resolve a fixture sintética.
    obterSubstituicaoMock.mockResolvedValue(FIXTURE_VIEW)
    // pb.send também cobre o caminho de leitura (obterSubstituicao delega a pb.send).
    mockPbSend(FIXTURE_VIEW)
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  // 1) loading: renderiza indicador de carregamento enquanto busca.
  it('renderiza indicador de carregamento enquanto busca a substituição', async () => {
    // id válido para que a página dispare a requisição de leitura.
    _useParams.mockReturnValue({ id: VALID_ID })
    // obterSubstituicao nunca resolve: loading permanece true.
    obterSubstituicaoMock.mockImplementation(() => new Promise(() => {}))
    pbSend.mockImplementation(() => new Promise(() => {}))

    render(<SubstituicaoDetalhe />)

    // Skeletons (animate-pulse) são o indicador de carregamento da página.
    await waitFor(() => {
      const pulses = document.querySelectorAll('.animate-pulse')
      expect(pulses.length).toBeGreaterThan(0)
    })
  })

  // 2) erro: exibe mensagem de erro quando a requisição falha.
  it('exibe mensagem de erro quando a requisição falha', async () => {
    _useParams.mockReturnValue({ id: VALID_ID })
    // Erro 500 (não-404): a página mostra o bloco de erro.
    obterSubstituicaoMock.mockRejectedValue(new ClientResponseError(500, { code: 500 }))

    render(<SubstituicaoDetalhe />)

    expect(await screen.findByText('Erro ao carregar')).toBeInTheDocument()
    expect(screen.getByText(/Não foi possível carregar os dados/i)).toBeInTheDocument()
  })

  // 3) dados carregados: exibe principais campos da substituição.
  it('exibe dados da substituição (principal, substituto, período, situação) quando retornada com sucesso', async () => {
    _useParams.mockReturnValue({ id: VALID_ID })
    obterSubstituicaoMock.mockResolvedValue(FIXTURE_VIEW)

    render(<SubstituicaoDetalhe />)

    // Titular (principal) e substituto principal.
    expect((await screen.findAllByText('Titular Fixtura')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Principal Fixtura').length).toBeGreaterThan(0)
    // Período formatado (dd/MM/yyyy).
    expect(screen.getByText(/10\/03\/2099 – 20\/03\/2099/)).toBeInTheDocument()
    // Situação (futura → badge "Futura").
    expect(screen.getByText('Futura')).toBeInTheDocument()
  })

  // 4) gate fechado (MUTATIONS_ENABLED=false): não exibe botões de ação.
  it('não exibe botões de ação (ajustar/cancelar) com gate fechado (MUTATIONS_ENABLED=false)', async () => {
    ffState.MUTATIONS_ENABLED = false
    _useParams.mockReturnValue({ id: VALID_ID })
    mockUseIsSuperAdmin({
      isSuperAdmin: true,
      perfilSlug: 'superadministrador',
      loading: false,
    })
    obterSubstituicaoMock.mockResolvedValue(FIXTURE_VIEW)

    expect(MUTATIONS_ENABLED).toBe(false)
    render(<SubstituicaoDetalhe />)

    // Dados carregados...
    await waitFor(() => {
      expect(screen.getAllByText('Titular Fixtura').length).toBeGreaterThan(0)
    })

    // ...mas sem botões de ação.
    expect(screen.queryByText('Ajustar')).not.toBeInTheDocument()
    expect(screen.queryByText(/Cancelar substituição/i)).not.toBeInTheDocument()
  })

  // 5) RBAC superadmin com gate aberto: exibe ajustar e cancelar.
  it('exibe botões de ajustar e cancelar para superadmin com gate aberto', async () => {
    ffState.MUTATIONS_ENABLED = true
    _useParams.mockReturnValue({ id: VALID_ID })
    mockUseIsSuperAdmin({
      isSuperAdmin: true,
      perfilSlug: 'superadministrador',
      loading: false,
    })
    obterSubstituicaoMock.mockResolvedValue(FIXTURE_VIEW)

    expect(MUTATIONS_ENABLED).toBe(true)
    render(<SubstituicaoDetalhe />)

    // Botão "Ajustar" (link de ação).
    expect(await screen.findByText('Ajustar')).toBeInTheDocument()
    // Botão "Cancelar substituição" (abre o diálogo de confirmação).
    expect(screen.getByText('Cancelar substituição')).toBeInTheDocument()
  })

  it('mantém o cancelamento disponível até o fim da data civil', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2099, 2, 20, 23, 30))
    _useParams.mockReturnValue({ id: VALID_ID })
    obterSubstituicaoMock.mockResolvedValue(FIXTURE_VIEW)

    render(<SubstituicaoDetalhe />)
    await act(async () => {})

    expect(screen.getByText('Cancelar substituição')).toBeInTheDocument()
  })

  // 6) RBAC operador-comercial com gate aberto: vê dados, não vê ações.
  it('operador-comercial com gate aberto vê os dados mas não vê botões de ajustar/cancelar', async () => {
    ffState.MUTATIONS_ENABLED = true
    _useParams.mockReturnValue({ id: VALID_ID })
    mockUseIsSuperAdmin({
      isSuperAdmin: false,
      perfilSlug: 'operador-comercial',
      loading: false,
    })
    obterSubstituicaoMock.mockResolvedValue(FIXTURE_VIEW)

    render(<SubstituicaoDetalhe />)

    // Vê os dados (leitura permitida).
    await waitFor(() => {
      expect(screen.getAllByText('Titular Fixtura').length).toBeGreaterThan(0)
    })

    // Não vê controles de mutação (perfil fora do allowlist).
    expect(screen.queryByText('Ajustar')).not.toBeInTheDocument()
    expect(screen.queryByText(/Cancelar substituição/i)).not.toBeInTheDocument()
  })

  // 7) 404 (não encontrado): exibe estado de "não encontrado".
  it('exibe estado de "não encontrado" quando a API retorna 404', async () => {
    _useParams.mockReturnValue({ id: VALID_ID })
    // ClientResponseError com status 404 → useSubstituicaoView seta notFound.
    obterSubstituicaoMock.mockRejectedValue(new ClientResponseError(404, { code: 404 }))

    render(<SubstituicaoDetalhe />)

    expect(await screen.findByText(/Substituição não encontrada/i)).toBeInTheDocument()
  })
})
