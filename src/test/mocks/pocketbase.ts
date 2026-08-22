import { vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────
// Mock do módulo @/lib/pocketbase/client.
//
// Uso: `vi.mock('@/lib/pocketbase/client')` registra este factory.
// Os helpers permitem sobrescrever o retorno por teste.
// ─────────────────────────────────────────────────────────────────────

export const pbSend = vi.fn()

const getList = vi.fn().mockResolvedValue({ items: [], totalItems: 0 })
const getOne = vi.fn().mockResolvedValue({ id: '1', name: 'Test', titulo: 'Test' })

function collection(_name: string) {
  return {
    getList,
    getOne,
  }
}

const pb = {
  send: pbSend,
  collection,
  authStore: {
    isValid: false,
    record: null,
    clear: vi.fn(),
    save: vi.fn(),
    onChange: vi.fn().mockReturnValue(() => {}),
  },
}

export default pb

// Re-export para testes que precisam simular erros do SDK.
export class ClientResponseError extends Error {
  status: number
  response: { code?: number; error?: string; data?: unknown }
  constructor(status = 0, response: { code?: number; error?: string; data?: unknown } = {}) {
    super(`ClientResponseError ${status}`)
    this.name = 'ClientResponseError'
    this.status = status
    this.response = response
  }
}

/** Sobrescreve o retorno de pb.send para um teste. */
export function mockPbSend(resolved: unknown): void {
  pbSend.mockResolvedValue(resolved)
}

/** Sobrescreve o retorno de pb.collection(name).getList para um teste. */
export function mockCollectionGetList(resolved: unknown): void {
  getList.mockResolvedValue(resolved)
}

export { getList, getOne }
