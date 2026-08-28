import { describe, it, expect } from 'vitest'
import {
  MUTATIONS_ENABLED,
  assertMutationsEnabled,
  MutationsDisabledError,
} from '@/lib/feature-flags'

describe('assertMutationsEnabled', () => {
  it('MUTATIONS_ENABLED está ativo (true) por padrão para o piloto no Preview', () => {
    expect(MUTATIONS_ENABLED).toBe(true)
  })

  it('permite execução normal quando habilitado (padrão)', () => {
    expect(() => assertMutationsEnabled('/backend/v1/substituicoes/criar')).not.toThrow()
  })

  it('lança MutationsDisabledError quando chamado com enabled=false', () => {
    expect(() => assertMutationsEnabled('/backend/v1/substituicoes/criar', false)).toThrow(
      MutationsDisabledError,
    )
  })
})
