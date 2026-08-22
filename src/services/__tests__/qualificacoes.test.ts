import { beforeEach, describe, expect, it, vi } from 'vitest'

const pbSend = vi.hoisted(() => vi.fn())
vi.mock('@/lib/pocketbase/client', () => ({ default: { send: pbSend } }))

import {
  decidirQualificacao,
  listarQualificacoesPendentes,
  mapQualificacaoError,
} from '@/services/qualificacoes'

beforeEach(() => {
  vi.clearAllMocks()
  pbSend.mockResolvedValue({})
})

describe('qualificações', () => {
  it('lista a fila somente por GET', async () => {
    await listarQualificacoesPendentes(2, 10)
    expect(pbSend).toHaveBeenCalledWith('/backend/v1/qualificacoes/pendentes', {
      method: 'GET',
      query: { pagina: '2', por_pagina: '10' },
    })
  })

  it('envia a decisão somente pelo endpoint protegido', async () => {
    const payload = {
      negocio_id: 'abc123def456ghi',
      decisao: 'qualificada' as const,
      motivo: null,
      justificativa: null,
      updated_esperado: '2026-08-20 10:00:00.000Z',
      command_idempotency_key: 'qualificacao:abc:key',
    }
    await decidirQualificacao(payload)
    expect(pbSend).toHaveBeenCalledWith(
      '/backend/v1/qualificacoes/decidir',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('traduz conflito de concorrência', () => {
    expect(mapQualificacaoError({ status: 409, response: { error: 'STALE_WRITE' } })).toBe(
      'O negócio foi alterado. Atualize a lista e tente novamente.',
    )
  })

  it('traduz decisão já registrada', () => {
    expect(mapQualificacaoError({ status: 409, response: { error: 'JA_DECIDIDO' } })).toBe(
      'Este prospect já recebeu uma decisão.',
    )
  })
})
