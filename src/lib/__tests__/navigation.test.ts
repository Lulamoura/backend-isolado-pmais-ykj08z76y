import { describe, expect, it } from 'vitest'

import { MAIN_MODULES, modulePathFor } from '@/lib/navigation'

describe('navegação por módulos', () => {
  it('mantém os módulos principais aprovados', () => {
    expect(MAIN_MODULES.map((item) => item.label)).toEqual([
      'Operação do Dia',
      'Pipeline Comercial',
      'Assistente Nexo',
      'Curadoria Nexo',
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
    ['/nexo', '/nexo'],
    ['/nexo/curadoria', '/nexo/curadoria'],
    ['/analises', '/analises'],
    ['/slas', '/foundation'],
    ['/substituicoes/abc', '/foundation'],
  ])('conecta %s ao módulo %s', (pathname, modulePath) => {
    expect(modulePathFor(pathname)).toBe(modulePath)
  })
})
