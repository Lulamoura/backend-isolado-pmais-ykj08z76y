import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (registrados ANTES de importar o SUT) ─────────────────────
const pbSend = vi.hoisted(() => vi.fn())

vi.mock('@/lib/pocketbase/client', () => ({
  default: {
    send: pbSend,
    collection: () => ({
      getList: vi.fn().mockResolvedValue({ items: [], totalItems: 0 }),
      getOne: vi.fn().mockResolvedValue({ id: '1', name: 'Test' }),
    }),
    authStore: {
      isValid: false,
      record: null,
      clear: vi.fn(),
      save: vi.fn(),
      onChange: vi.fn().mockReturnValue(() => {}),
    },
  },
}))

// MUTATIONS_ENABLED default true; testes de gate sobrescrevem via vi.doMock.
vi.mock('@/lib/feature-flags', async () => {
  const actual = await vi.importActual<typeof import('@/lib/feature-flags')>('@/lib/feature-flags')
  return { ...actual, MUTATIONS_ENABLED: true, assertMutationsEnabled: vi.fn() }
})

import {
  consultarSubstituicoes,
  obterSubstituicao,
  criarSubstituicao,
  ajustarSubstituicao,
  cancelarSubstituicao,
  toQueryParams,
  mapSubstituicaoError,
} from '@/services/substituicoes'

beforeEach(() => {
  vi.clearAllMocks()
  pbSend.mockResolvedValue({})
})

// ── Paths (5 casos) ──────────────────────────────────────────────────
describe('paths', () => {
  it('consultarSubstituicoes chama pb.send com path /backend/v1/substituicoes/consulta e method GET', async () => {
    await consultarSubstituicoes({ pagina: 1, por_pagina: 20 })
    expect(pbSend).toHaveBeenCalledWith(
      '/backend/v1/substituicoes/consulta',
      expect.objectContaining({ method: 'GET', query: expect.any(Object) }),
    )
  })

  it("obterSubstituicao('abc') chama pb.send com path /consulta e query contendo id='abc'", async () => {
    await obterSubstituicao('abc')
    expect(pbSend).toHaveBeenCalledWith(
      '/backend/v1/substituicoes/consulta',
      expect.objectContaining({ method: 'GET', query: { id: 'abc' } }),
    )
  })

  it('criarSubstituicao(payload) chama pb.send com path /criar e method POST', async () => {
    await criarSubstituicao({
      command_idempotency_key: 'k1',
      creation_idempotency_key: 'k2',
      titular_id: 't1',
      substituto_principal_id: null,
      substituto_reserva_id: null,
      data_inicio: '2025-01-01',
      data_fim: '2025-01-10',
      tipo_cobertura: 'integral',
      negocios_cobertos: null,
      motivo: 'ferias',
      observacao: null,
    })
    expect(pbSend).toHaveBeenCalledWith(
      '/backend/v1/substituicoes/criar',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it("ajustarSubstituicao('abc', payload) chama pb.send com path /ajustar e method POST", async () => {
    await ajustarSubstituicao({
      command_idempotency_key: 'k1',
      id: 'abc',
      updated_esperado: '2025-01-01T00:00:00Z',
      data_inicio: '2025-01-01',
      data_fim: '2025-01-10',
      substituto_principal_id: null,
      substituto_reserva_id: null,
      negocios_cobertos: null,
      observacao: null,
    })
    expect(pbSend).toHaveBeenCalledWith(
      '/backend/v1/substituicoes/ajustar',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it("cancelarSubstituicao('abc', payload) chama pb.send com path /cancelar e method POST", async () => {
    await cancelarSubstituicao({
      id: 'abc',
      updated_esperado: '2025-01-01T00:00:00Z',
      justificativa_cancelamento: 'motivo',
      command_idempotency_key: 'k1',
    })
    expect(pbSend).toHaveBeenCalledWith(
      '/backend/v1/substituicoes/cancelar',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

// ── toQueryParams (6 casos) ─────────────────────────────────────────
describe('toQueryParams', () => {
  it('null → omitido (objeto vazio)', () => {
    expect(toQueryParams({ a: null })).toEqual({})
  })

  it('undefined → omitido (objeto vazio)', () => {
    expect(toQueryParams({ a: undefined })).toEqual({})
  })

  it('string → valor preservado', () => {
    expect(toQueryParams({ a: 'abc' })).toEqual({ a: 'abc' })
  })

  it('number → valor convertido para string', () => {
    expect(toQueryParams({ a: 42 })).toEqual({ a: '42' })
  })

  it('objeto com múltiplas chaves → query string correta', () => {
    expect(toQueryParams({ a: '1', b: 2, c: 'x', d: null, e: undefined })).toEqual({
      a: '1',
      b: '2',
      c: 'x',
    })
  })

  it('objeto vazio → string vazia', () => {
    expect(toQueryParams({})).toEqual({})
  })
})

// ── mapSubstituicaoError (9 casos) ──────────────────────────────────
describe('mapSubstituicaoError', () => {
  function errWith(status: number, code?: string) {
    return { status, response: { code, error: code } }
  }

  it('status 400 → mensagem genérica de dados inválidos', () => {
    expect(mapSubstituicaoError(errWith(400))).toBe(
      'Dados inválidos. Verifique os campos e tente novamente.',
    )
  })

  it('status 401 → "Sessão expirada"', () => {
    expect(mapSubstituicaoError(errWith(401))).toBe('Sessão expirada. Faça login novamente.')
  })

  it('status 403 → "Sem permissão"', () => {
    expect(mapSubstituicaoError(errWith(403))).toBe(
      'Você não tem permissão para realizar esta operação.',
    )
  })

  it('status 404 → "Não encontrado"', () => {
    expect(mapSubstituicaoError(errWith(404))).toBe('Substituição não encontrada.')
  })

  it('status 500 → "Erro interno do servidor"', () => {
    expect(mapSubstituicaoError(errWith(500))).toBe('Erro interno. Tente novamente mais tarde.')
  })

  it('409 com código "JANELA_FECHADA" → mensagem específica', () => {
    expect(mapSubstituicaoError(errWith(409, 'JANELA_FECHADA'))).toBe(
      'A janela da substituição já está aberta ou encerrada e não pode ser ajustada.',
    )
  })

  it('409 com código "JA_CANCELADO" → mensagem específica', () => {
    expect(mapSubstituicaoError(errWith(409, 'JA_CANCELADO'))).toBe(
      'Esta substituição já foi cancelada.',
    )
  })

  it('409 com código "STALE_WRITE" → mensagem específica', () => {
    expect(mapSubstituicaoError(errWith(409, 'STALE_WRITE'))).toBe(
      'Os dados foram alterados por outro usuário. Recarregue a página e tente novamente.',
    )
  })

  it('erro sem response → mensagem padrão', () => {
    expect(mapSubstituicaoError(new Error('boom'))).toBe('Erro inesperado. Tente novamente.')
  })
})

// ── Gate (3 casos) ──────────────────────────────────────────────────
// Para o gate usamos vi.resetModules + vi.doMock para reimportar o SUT
// com MUTATIONS_ENABLED=false.
describe('gate fechado', () => {
  async function importSutWithGateClosed() {
    vi.resetModules()
    vi.doMock('@/lib/feature-flags', () => ({
      MUTATIONS_ENABLED: false,
      assertMutationsEnabled: (endpoint: string) => {
        throw new Error(`MUTATIONS_DISABLED: ${endpoint}`)
      },
      MutationsDisabledError: class MutationsDisabledError extends Error {
        endpoint: string
        constructor(endpoint: string) {
          super(`MUTATIONS_DISABLED: ${endpoint}`)
          this.name = 'MutationsDisabledError'
          this.endpoint = endpoint
        }
      },
    }))
    vi.doMock('@/lib/pocketbase/client', () => ({
      default: { send: pbSend, collection: () => ({}) },
    }))
    const mod = await import('@/services/substituicoes')
    return mod
  }

  it('criarSubstituicao NÃO chama pb.send quando gate fechado', async () => {
    const { criarSubstituicao: criar } = await importSutWithGateClosed()
    await expect(
      criar({
        command_idempotency_key: 'k1',
        creation_idempotency_key: 'k2',
        titular_id: 't1',
        substituto_principal_id: null,
        substituto_reserva_id: null,
        data_inicio: '2025-01-01',
        data_fim: '2025-01-10',
        tipo_cobertura: 'integral',
        negocios_cobertos: null,
        motivo: 'ferias',
        observacao: null,
      }),
    ).rejects.toThrow()
    expect(pbSend).not.toHaveBeenCalled()
  })

  it('ajustarSubstituicao NÃO chama pb.send quando gate fechado', async () => {
    const { ajustarSubstituicao: ajustar } = await importSutWithGateClosed()
    await expect(
      ajustar({
        command_idempotency_key: 'k1',
        id: 'abc',
        updated_esperado: '2025-01-01T00:00:00Z',
        data_inicio: '2025-01-01',
        data_fim: '2025-01-10',
        substituto_principal_id: null,
        substituto_reserva_id: null,
        negocios_cobertos: null,
        observacao: null,
      }),
    ).rejects.toThrow()
    expect(pbSend).not.toHaveBeenCalled()
  })

  it('cancelarSubstituicao NÃO chama pb.send quando gate fechado', async () => {
    const { cancelarSubstituicao: cancelar } = await importSutWithGateClosed()
    await expect(
      cancelar({
        id: 'abc',
        updated_esperado: '2025-01-01T00:00:00Z',
        justificativa_cancelamento: 'motivo',
        command_idempotency_key: 'k1',
      }),
    ).rejects.toThrow()
    expect(pbSend).not.toHaveBeenCalled()
  })
})

// ── Payloads (2 casos) ──────────────────────────────────────────────
describe('payloads', () => {
  it('criarSubstituicao envia payload com todos os campos esperados', async () => {
    await criarSubstituicao({
      command_idempotency_key: 'cmd-1',
      creation_idempotency_key: 'cre-1',
      titular_id: 't1',
      substituto_principal_id: 'p1',
      substituto_reserva_id: 'r1',
      data_inicio: '2025-01-01',
      data_fim: '2025-01-10',
      tipo_cobertura: 'por_negocios',
      negocios_cobertos: ['n1'],
      motivo: 'ferias',
      observacao: 'obs',
    })
    const body = JSON.parse(pbSend.mock.calls[0][1].body)
    expect(body).toMatchObject({
      titular_id: 't1',
      substituto_principal_id: 'p1',
      substituto_reserva_id: 'r1',
      data_inicio: '2025-01-01',
      data_fim: '2025-01-10',
      tipo_cobertura: 'por_negocios',
      negocios_cobertos: ['n1'],
      motivo: 'ferias',
      observacao: 'obs',
      creation_idempotency_key: 'cre-1',
    })
  })

  it('cancelarSubstituicao envia payload com justificativa, updated_esperado e command_idempotency_key', async () => {
    await cancelarSubstituicao({
      id: 'abc',
      updated_esperado: '2025-01-01T00:00:00Z',
      justificativa_cancelamento: 'motivo',
      command_idempotency_key: 'cmd-x',
    })
    const body = JSON.parse(pbSend.mock.calls[0][1].body)
    expect(body).toMatchObject({
      justificativa_cancelamento: 'motivo',
      updated_esperado: '2025-01-01T00:00:00Z',
      command_idempotency_key: 'cmd-x',
    })
  })
})
