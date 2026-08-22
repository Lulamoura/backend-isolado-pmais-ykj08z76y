import { beforeEach, describe, expect, it, vi } from 'vitest'

const pbSend = vi.hoisted(() => vi.fn())

vi.mock('@/lib/pocketbase/client', () => ({
  default: { send: pbSend },
}))

import { getDashboardResumo } from '@/services/dashboard'

beforeEach(() => {
  vi.clearAllMocks()
  pbSend.mockResolvedValue({})
})

describe('getDashboardResumo', () => {
  it('usa somente GET no endpoint do Dashboard V1', async () => {
    await getDashboardResumo()

    expect(pbSend).toHaveBeenCalledTimes(1)
    expect(pbSend).toHaveBeenCalledWith('/backend/v1/dashboard/resumo', {
      method: 'GET',
      query: {},
    })
  })

  it('serializa os filtros aceitos pelo contrato backend', async () => {
    await getDashboardResumo({
      inicio: '2026-05-22',
      fim: '2026-08-19',
      equipe_id: 'abc123def456ghi',
      responsavel_id: 'def456ghi789jkl',
      incluir_inativos: false,
    })

    expect(pbSend).toHaveBeenCalledWith('/backend/v1/dashboard/resumo', {
      method: 'GET',
      query: {
        inicio: '2026-05-22',
        fim: '2026-08-19',
        equipe_id: 'abc123def456ghi',
        responsavel_id: 'def456ghi789jkl',
        incluir_inativos: 'false',
      },
    })
  })

  it('preserva incluir_inativos=true como booleano estrito serializado', async () => {
    await getDashboardResumo({ incluir_inativos: true })

    expect(pbSend).toHaveBeenCalledWith('/backend/v1/dashboard/resumo', {
      method: 'GET',
      query: { incluir_inativos: 'true' },
    })
  })
})
