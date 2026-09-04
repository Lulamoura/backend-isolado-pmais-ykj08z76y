import { describe, expect, it } from 'vitest'

import { filtrarOrdensExecucao, normalizarEstadoOrdemExecucao } from '@/pages/OrdensExecucao'
import type { ItemOE } from '@/services/ordens-execucao'

const item = (estado: ItemOE['estado_operacional'], data: string) =>
  ({ estado_operacional: estado, negocio: { data_periodo: data } }) as ItemOE

describe('filtros de Ordens de Execução', () => {
  it('normaliza o parâmetro de status sem aceitar valores desconhecidos', () => {
    expect(normalizarEstadoOrdemExecucao('aguardando_oe')).toBe('aguardando_oe')
    expect(normalizarEstadoOrdemExecucao('em_processo_de_entrega')).toBe('em_processo_de_entrega')
    expect(normalizarEstadoOrdemExecucao('invalido')).toBe('todos')
    expect(normalizarEstadoOrdemExecucao(null)).toBe('todos')
  })

  it('exibe somente negócios aguardando OE quando solicitado pela Operação do Dia', () => {
    const itens = [
      item('aguardando_oe', '2026-09-01T12:00:00.000Z'),
      item('em_processo_de_entrega', '2026-09-01T12:00:00.000Z'),
    ]

    expect(filtrarOrdensExecucao(itens, 'aguardando_oe', '2026-08-01', '2026-09-30')).toEqual([
      itens[0],
    ])
  })

  it('mantém a visão geral do Pipeline e combina status com o período', () => {
    const itens = [
      item('aguardando_oe', '2026-09-01T12:00:00.000Z'),
      item('em_processo_de_entrega', '2026-09-02T12:00:00.000Z'),
      item('aguardando_oe', '2026-05-01T12:00:00.000Z'),
    ]

    expect(filtrarOrdensExecucao(itens, 'todos', '2026-08-01', '2026-09-30')).toEqual([
      itens[0],
      itens[1],
    ])
    expect(
      filtrarOrdensExecucao(itens, 'em_processo_de_entrega', '2026-08-01', '2026-09-30'),
    ).toEqual([itens[1]])
  })
})
