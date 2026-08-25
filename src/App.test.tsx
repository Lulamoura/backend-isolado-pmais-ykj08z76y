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

describe('App routing com gate fechado', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.pushState({}, '', '/')
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

  it('hash verification', async () => {
    // dynamically check node crypto or browser crypto
    const fs = await import('fs')
    const crypto = await import('crypto')
    const contentRec = fs.readFileSync('pocketbase/hooks/com_ac_reconciliacao.js', 'utf8')
    const contentProp = fs.readFileSync('pocketbase/hooks/com_propostas_operacao.js', 'utf8')
    const hashRec = crypto.createHash('sha256').update(contentRec).digest('hex')
    const hashProp = crypto.createHash('sha256').update(contentProp).digest('hex')
    console.log('HASH_REC:', hashRec)
    console.log('HASH_PROP:', hashProp)
    expect(hashRec).toBe('f1dc6a74518d0c5e0b5dd6f27a674a6a7eb76e99aef6fc7f40dcf86aed11a2ed')
    expect(hashProp).toBe('264322cf8c64070c3f8a0f65097d23406828cda3cfe6475618542600bd43c25a')
  })
})
