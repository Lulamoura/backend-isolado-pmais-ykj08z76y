import { describe, expect, it } from 'vitest'

import { filtrarOrdensExecucao } from '@/pages/OrdensExecucao'
import type { ItemOE } from '@/services/ordens-execucao'

const item = (estado: ItemOE['estado_operacional'], data: string) =>
  ({ estado_operacional: estado, negocio: { data_periodo: data } }) as ItemOE

describe('filtros de Ordens de Execução', () => {
  it('exibe somente negócios que ainda aguardam o número da OE', () => {
    const itens = [
      item('aguardando_oe', '2026-09-01T12:00:00.000Z'),
      item('em_processo_de_entrega', '2026-09-01T12:00:00.000Z'),
    ]

    expect(filtrarOrdensExecucao(itens, '2026-08-01', '2026-09-30')).toEqual([itens[0]])
  })

  it('combina a pendência da OE com o período selecionado', () => {
    const itens = [
      item('aguardando_oe', '2026-09-01T12:00:00.000Z'),
      item('em_processo_de_entrega', '2026-09-02T12:00:00.000Z'),
      item('aguardando_oe', '2026-05-01T12:00:00.000Z'),
    ]

    expect(filtrarOrdensExecucao(itens, '2026-08-01', '2026-09-30')).toEqual([itens[0]])
  })
})
