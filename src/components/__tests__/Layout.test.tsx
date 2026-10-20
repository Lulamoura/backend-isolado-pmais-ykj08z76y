import { describe, expect, it } from 'vitest'

import {
  contarPendenciasCuradoriaUnificada,
  CURADORIA_BADGE_LIMITE,
  getSubstituicoesPageTitle,
} from '@/components/Layout'

describe('contarPendenciasCuradoriaUnificada', () => {
  it('consulta a mesma janela de casos exibida na Curadoria Comercial', () => {
    expect(CURADORIA_BADGE_LIMITE).toBe(50)
  })

  it('usa somente as filas exibidas como pendentes na Curadoria Comercial', () => {
    expect(
      contarPendenciasCuradoriaUnificada({
        para_tratar: 2,
        aguardando_decisao: 1,
        conhecimento_aprovado: 7,
        historico: 9,
      }),
    ).toBe(3)
  })
})

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
