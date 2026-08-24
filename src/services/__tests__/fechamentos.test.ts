import { describe, expect, it } from 'vitest'

import { motivoPerdaLabel } from '@/services/fechamentos'

describe('fechamentos', () => {
  it('traduz os motivos canônicos exibidos nos cards de perdas', () => {
    expect(motivoPerdaLabel('fechou_com_outra_empresa')).toBe('Fechou com outra empresa')
    expect(motivoPerdaLabel('desistiu')).toBe('Desistiu')
  })

  it('explicita quando o motivo não foi informado', () => {
    expect(motivoPerdaLabel(null)).toBe('Não informado')
  })
})
