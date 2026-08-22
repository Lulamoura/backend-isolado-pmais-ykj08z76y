import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

// 2) Mock do gate de feature-flags — MUTATIONS_ENABLED = true
//    (o gate fechado redireciona /substituicoes/:id/ajustar para NotFound).
vi.mock('@/lib/feature-flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/feature-flags')>()
  return {
    ...actual,
    MUTATIONS_ENABLED: true as const,
  }
})

// 3) Mock de auth existente (src/test/mocks/auth.ts é .ts puro, sem JSX).
vi.mock('@/hooks/use-is-superadmin', async () => {
  const mod = await import('@/test/mocks/auth')
  return { useIsSuperAdmin: mod.useIsSuperAdmin }
})

// 4) Mock de react-router-dom. Não importamos src/test/mocks/router.ts
//    porque ele contém JSX num arquivo .ts, o que o oxlint/tsc tratam
//    como erro de parse. Inlinamos apenas o necessário com vi.fn.
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

// 5) crypto.randomUUID determinístico (via stubGlobal, aplicado no beforeEach).
const DETERMINISTIC_UUID = 'uuid-deterministico-1234'

// Reimport controlado do gate para afirmar o estado do mock.
import { MUTATIONS_ENABLED } from '@/lib/feature-flags'
// Acesso ao mock de pb.send (mesma instância registrada no factory).
import { pbSend, mockPbSend } from '@/test/mocks/pocketbase'

// Import do SUT APÓS os mocks.
import SubstituicaoAjuste from '@/pages/SubstituicaoAjuste'

// ─────────────────────────────────────────────────────────────────────
// Fixture sintética — zero rede real.
// ─────────────────────────────────────────────────────────────────────
const VALID_ID = '1234567890abcde' // 15 chars [a-z0-9], satisfaz ID_REGEX

const FIXTURE_VIEW: SubstituicaoView = {
  id: VALID_ID,
  data_inicio: '2025-01-10T00:00:00.000Z',
  data_fim: '2025-01-20T00:00:00.000Z',
  tipo_cobertura: 'integral',
  motivo: 'ferias',
  cancelada_em: null,
  situacao: 'futura',
  titular: { id: 'titular00000001', name: 'Titular Fixtura' },
  substituto_principal: { id: 'principal0000001', name: 'Principal Fixtura' },
  substituto_reserva: null,
  negocios_cobertos: [],
  observacao: null,
  justificativa_cancelamento: null,
  autor: null,
  created: '2025-01-01T00:00:00.000Z',
  updated: '2025-01-02T00:00:00.000Z',
}

describe('SubstituicaoAjuste', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _useParams.mockReturnValue({ id: VALID_ID })
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue(DETERMINISTIC_UUID),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('renderiza sem crash com gate aberto (MUTATIONS_ENABLED=true) e id válido', async () => {
    // Afirmar que o gate está aberto — caso contrário a rota seria NotFound.
    expect(MUTATIONS_ENABLED).toBe(true)

    // pb.send resolve a view sintética na leitura (obterSubstituicao).
    mockPbSend(FIXTURE_VIEW)

    render(<SubstituicaoAjuste />)

    // Título da página aparece após o carregamento da view sintética.
    await waitFor(() => {
      expect(screen.getByText('Ajustar substituição')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: '10/01/2025' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '20/01/2025' })).toBeInTheDocument()

    // Sanity: pb.send foi chamado para carregar a view (leitura).
    expect(pbSend).toHaveBeenCalled()
  })
})
