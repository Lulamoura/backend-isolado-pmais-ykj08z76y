import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { SubstituicaoItem } from '@/services/substituicoes'

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
const { _useNavigate, _useSearchParams } = vi.hoisted(() => ({
  _useNavigate: vi.fn().mockReturnValue(vi.fn()),
  _useSearchParams: vi.fn().mockReturnValue([new URLSearchParams(), vi.fn()]),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  const React = await import('react')
  const LinkStub = React.forwardRef<HTMLAnchorElement, { to?: string; children?: React.ReactNode }>(
    ({ to, children }, ref) => React.createElement('a', { href: to ?? '#', ref }, children),
  )
  LinkStub.displayName = 'LinkStub'
  return {
    ...actual,
    useNavigate: _useNavigate,
    useSearchParams: _useSearchParams,
    Link: LinkStub,
  }
})

// Imports pós-mock.
import { MUTATIONS_ENABLED } from '@/lib/feature-flags'
import { pbSend, mockPbSend } from '@/test/mocks/pocketbase'
import { mockUseIsSuperAdmin } from '@/test/mocks/auth'
import SubstituicoesLista from '@/pages/SubstituicoesLista'

// ─────────────────────────────────────────────────────────────────────
// Fixture sintética — zero rede real.
// ─────────────────────────────────────────────────────────────────────
const FIXTURE_ITEM: SubstituicaoItem = {
  id: 'sub-lista-001',
  data_inicio: '2025-02-10T00:00:00.000Z',
  data_fim: '2025-02-20T00:00:00.000Z',
  tipo_cobertura: 'integral',
  motivo: 'ferias',
  cancelada_em: null,
  situacao: 'futura',
  titular: { id: 'titular001', name: 'Titular Fixtura' },
  substituto_principal: { id: 'principal001', name: 'Principal Fixtura' },
  substituto_reserva: null,
}

function mockListaResponse(items: SubstituicaoItem[] = [FIXTURE_ITEM]) {
  mockPbSend({
    substituicoes: items,
    pagina: 1,
    por_pagina: 20,
    has_more: false,
  })
}

describe('SubstituicoesLista', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ffState.MUTATIONS_ENABLED = true
    mockUseIsSuperAdmin({
      isSuperAdmin: true,
      perfilSlug: 'superadministrador',
      loading: false,
    })
    mockListaResponse([FIXTURE_ITEM])
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('gate fechado (MUTATIONS_ENABLED=false) não exibe o controle de criação', async () => {
    ffState.MUTATIONS_ENABLED = false
    // Mesmo com perfil autorizado, o gate bloqueia o botão "Nova substituição".
    mockUseIsSuperAdmin({
      isSuperAdmin: true,
      perfilSlug: 'superadministrador',
      loading: false,
    })
    mockListaResponse([FIXTURE_ITEM])

    expect(MUTATIONS_ENABLED).toBe(false)
    render(<SubstituicoesLista />)

    // Lista visível...
    await waitFor(() => {
      expect(screen.getByText('Titular Fixtura')).toBeInTheDocument()
    })

    // ...mas sem controles de mutação.
    expect(screen.queryByText('Nova substituição')).not.toBeInTheDocument()
    // Nada de mutação real: pb.send só pode ter sido chamado para consulta.
    const calls = pbSend.mock.calls.map((c) => String(c[0]))
    expect(calls.every((u) => u.includes('/consulta'))).toBe(true)
  })

  it('superadmin vê o controle de ação (nova substituição) e a lista', async () => {
    ffState.MUTATIONS_ENABLED = true
    mockUseIsSuperAdmin({
      isSuperAdmin: true,
      perfilSlug: 'superadministrador',
      loading: false,
    })
    mockListaResponse([FIXTURE_ITEM])

    expect(MUTATIONS_ENABLED).toBe(true)
    render(<SubstituicoesLista />)

    expect(await screen.findByText('Nova substituição')).toBeInTheDocument()
    expect(screen.getByText('Titular Fixtura')).toBeInTheDocument()
    expect(screen.getByText('10/02/2025 – 20/02/2025')).toBeInTheDocument()
  })

  it('identifica de forma acessível a região rolável da tabela', async () => {
    render(<SubstituicoesLista />)

    await screen.findByText('Titular Fixtura')

    expect(
      screen.getByRole('region', {
        name: 'Tabela de substituições — deslize horizontalmente para ver todas as colunas',
      }),
    ).toBeInTheDocument()
  })

  it('operador-comercial vê a lista e não vê controles de ajustar/cancelar', async () => {
    ffState.MUTATIONS_ENABLED = true
    mockUseIsSuperAdmin({
      isSuperAdmin: false,
      perfilSlug: 'operador-comercial',
      loading: false,
    })
    mockListaResponse([FIXTURE_ITEM])

    render(<SubstituicoesLista />)

    // Vê a lista (dados carregados).
    await waitFor(() => {
      expect(screen.getByText('Titular Fixtura')).toBeInTheDocument()
    })

    // A página de lista não expõe controles de ajustar/cancelar.
    expect(screen.queryByText(/Ajustar/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Cancelar/i)).not.toBeInTheDocument()
  })

  it('usuário sem permissão (perfilSlug=null) não vê controles de criação', async () => {
    ffState.MUTATIONS_ENABLED = true
    mockUseIsSuperAdmin({
      isSuperAdmin: false,
      perfilSlug: null,
      loading: false,
    })
    mockListaResponse([FIXTURE_ITEM])

    render(<SubstituicoesLista />)

    // A lista ainda carrega (consulta é de leitura), mas sem o controle de mutação.
    await waitFor(() => {
      expect(screen.getByText('Titular Fixtura')).toBeInTheDocument()
    })

    expect(screen.queryByText('Nova substituição')).not.toBeInTheDocument()
  })

  it('estado de loading exibe indicador visível enquanto carrega', async () => {
    // pb.send nunca resolve: loading permanece true e os skeletons aparecem.
    pbSend.mockImplementation(() => new Promise(() => {}))

    render(<SubstituicoesLista />)

    // Skeletons são renderizados como <div class="animate-pulse ...">.
    await waitFor(() => {
      const pulses = document.querySelectorAll('.animate-pulse')
      expect(pulses.length).toBeGreaterThan(0)
    })
  })

  it('estado vazio exibe "Nenhuma substituição encontrada" quando a lista retorna vazia', async () => {
    mockListaResponse([])

    render(<SubstituicoesLista />)

    expect(await screen.findByText(/Nenhuma substituição encontrada/)).toBeInTheDocument()
  })
})
