import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock do módulo de feature-flags: MUTATIONS_ENABLED = false, mantendo a
// implementação real de assertMutationsEnabled e MutationsDisabledError.
vi.mock('@/lib/feature-flags', async () => {
  const actual = await vi.importActual<typeof import('@/lib/feature-flags')>('@/lib/feature-flags')
  return {
    ...actual,
    MUTATIONS_ENABLED: false,
  }
})

describe('assertMutationsEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lança MutationsDisabledError quando MUTATIONS_ENABLED=false', async () => {
    const { assertMutationsEnabled, MutationsDisabledError } = await import('@/lib/feature-flags')
    expect(() => assertMutationsEnabled('/backend/v1/substituicoes/criar')).toThrow(
      MutationsDisabledError,
    )
  })
})
