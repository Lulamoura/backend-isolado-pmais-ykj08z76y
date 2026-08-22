import { beforeEach, describe, expect, it, vi } from 'vitest'

const pbSend = vi.hoisted(() => vi.fn())

vi.mock('@/lib/pocketbase/client', () => ({
  default: { send: pbSend },
}))

import { getFilaSemCobertura } from '@/services/fila'

beforeEach(() => {
  vi.clearAllMocks()
  pbSend.mockResolvedValue({
    negocios_sem_cobertura: [],
    pagina: 1,
    por_pagina: 20,
    has_more: false,
  })
})

describe('getFilaSemCobertura', () => {
  it('usa o endpoint GET registrado no backend', async () => {
    await getFilaSemCobertura()

    expect(pbSend).toHaveBeenCalledWith('/backend/v1/fila/sem-cobertura', {
      method: 'GET',
      query: {},
    })
  })

  it('serializa os parâmetros aceitos como strings', async () => {
    await getFilaSemCobertura({
      pagina: 2,
      por_pagina: 10,
      ordenar_por: 'valor',
      ordem: 'asc',
    })

    expect(pbSend).toHaveBeenCalledWith('/backend/v1/fila/sem-cobertura', {
      method: 'GET',
      query: {
        pagina: '2',
        por_pagina: '10',
        ordenar_por: 'valor',
        ordem: 'asc',
      },
    })
  })
})
