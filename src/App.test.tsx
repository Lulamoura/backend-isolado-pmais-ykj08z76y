import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// ── Mocks (registrados ANTES de importar o SUT) ─────────────────────
vi.mock('@/lib/feature-flags', () => ({
  MUTATIONS_ENABLED: false,
  assertMutationsEnabled: (endpoint: string) => {
    throw new Error(`MUTATIONS_DISABLED: ${endpoint}`)
  },
  MutationsDisabledError: class MutationsDisabledError extends Error {
    endpoint: string
    constructor(endpoint: string) {
      super(`MUTATIONS_DISABLED: ${endpoint}`)
      this.name = 'MutationsDisabledError'
      this.endpoint = endpoint
    }
  },
}))

vi.mock('@/lib/pocketbase/client', () => ({
  default: {
    send: vi.fn().mockResolvedValue({}),
    collection: () => ({
      getList: vi.fn().mockResolvedValue({ items: [], totalItems: 0 }),
      getOne: vi.fn().mockResolvedValue({ id: '1', name: 'Test' }),
    }),
    authStore: {
      isValid: true,
      record: { id: 'u1', name: 'Test', ativo_comercial: true },
      clear: vi.fn(),
      save: vi.fn(),
      onChange: vi.fn().mockReturnValue(() => {}),
    },
  },
}))

vi.mock('@/hooks/use-is-superadmin', () => ({
  useIsSuperAdmin: vi.fn().mockReturnValue({
    isSuperAdmin: false,
    perfilSlug: 'superadministrador',
    loading: false,
  }),
}))

vi.mock('@/hooks/use-auth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: { id: 'u1', name: 'Test', ativo_comercial: true },
    isAuthenticated: true,
    loading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-permissions', () => ({
  PermissionsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePermissions: () => ({
    permissions: {},
    hasPermission: () => true,
    getScope: () => null,
    loading: false,
  }),
}))

// SUT importado DEPOIS dos mocks.
import App from './App'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'

describe('App routing com gate fechado', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useIsSuperAdmin).mockReturnValue({
      isSuperAdmin: false,
      perfilSlug: 'superadministrador',
      loading: false,
    })
    window.history.pushState({}, '', '/')
  })

  it('bloqueia Qualificação com mensagem explícita para negociação própria', () => {
    vi.mocked(useIsSuperAdmin).mockReturnValue({
      isSuperAdmin: false,
      perfilSlug: 'negociacao-propria',
      loading: false,
    })
    window.history.pushState({}, '', '/qualificacao')
    render(<App />)
    expect(screen.getByText('Acesso não autorizado')).toBeInTheDocument()
    expect(screen.queryByText('Qualificação')).not.toBeInTheDocument()
  })

  it('falha fechada quando o perfil não pode ser resolvido', () => {
    vi.mocked(useIsSuperAdmin).mockReturnValue({
      isSuperAdmin: false,
      perfilSlug: null,
      loading: false,
    })
    window.history.pushState({}, '', '/ordens-execucao')
    render(<App />)
    expect(screen.getByText('Perfil não validado')).toBeInTheDocument()
    expect(screen.queryByText('Ordens de Execução')).not.toBeInTheDocument()
  })

  it('navegar para /substituicoes/nova com MUTATIONS_ENABLED=false renderiza NotFound', () => {
    window.history.pushState({}, '', '/substituicoes/nova')
    render(<App />)
    expect(screen.getByText('404')).toBeInTheDocument()
    // Não renderiza a página Nova (que exibiria "Nova substituição")
    expect(screen.queryByText('Nova substituição')).not.toBeInTheDocument()
  })

  it('navegar para /substituicoes/abc123/ajustar com MUTATIONS_ENABLED=false renderiza NotFound', () => {
    window.history.pushState({}, '', '/substituicoes/abc123/ajustar')
    render(<App />)
    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.queryByText('Ajustar substituição')).not.toBeInTheDocument()
  })
})
