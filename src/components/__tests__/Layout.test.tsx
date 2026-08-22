import { describe, expect, it } from 'vitest'

import { getSubstituicoesPageTitle } from '@/components/Layout'

describe('getSubstituicoesPageTitle', () => {
  it.each([
    ['/substituicoes', 'Substituições'],
    ['/substituicoes/nova', 'Nova substituição'],
    ['/substituicoes/sub-001', 'Detalhes da substituição'],
    ['/substituicoes/sub-001/ajustar', 'Ajustar substituição'],
  ])('mapeia %s para %s', (pathname, expectedTitle) => {
    expect(getSubstituicoesPageTitle(pathname)).toBe(expectedTitle)
  })

  it.each(['/substituicoes/nova', '/substituicoes/sub-001/ajustar'])(
    'não anuncia a rota mutante %s quando o gate está fechado',
    (pathname) => {
      expect(getSubstituicoesPageTitle(pathname, false)).toBeNull()
    },
  )
})
