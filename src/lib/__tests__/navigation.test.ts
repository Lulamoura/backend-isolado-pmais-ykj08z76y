import { describe, expect, it } from 'vitest'

import { MAIN_MODULES, modulePathFor } from '@/lib/navigation'

describe('navegação por módulos', () => {
  it('mantém somente quatro módulos principais', () => {
    expect(MAIN_MODULES.map((item) => item.label)).toEqual([
      'Operação do Dia',
      'Pipeline Comercial',
      'Análises',
      'Administração',
    ])
  })

  it.each([
    ['/atividades', '/'],
    ['/qualificacao', '/pipeline'],
    ['/propostas', '/pipeline'],
    ['/fechamentos', '/pipeline'],
    ['/ordens-execucao', '/pipeline'],
    ['/analises', '/analises'],
    ['/slas', '/foundation'],
    ['/substituicoes/abc', '/foundation'],
  ])('conecta %s ao módulo %s', (pathname, modulePath) => {
    expect(modulePathFor(pathname)).toBe(modulePath)
  })
})
