import { beforeEach, describe, expect, it, vi } from 'vitest'

const pbSend = vi.hoisted(() => vi.fn())

vi.mock('@/lib/pocketbase/client', () => ({
  default: { send: pbSend },
}))

import {
  IPCP_DIARIO_READONLY_PATH,
  obterIpcpDiarioReadOnly,
  ipcpDiarioFixtureHomologado,
} from '@/services/ipcp'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('obterIpcpDiarioReadOnly', () => {
  it('consulta o endpoint read-only do IPCP por GET', async () => {
    pbSend.mockResolvedValue({
      ...ipcpDiarioFixtureHomologado,
      contrato: 'ipcp_diario_readonly_v0_2',
      resumo_nexo: { ...ipcpDiarioFixtureHomologado.resumo_nexo, texto: 'Resposta do endpoint' },
    })

    const data = await obterIpcpDiarioReadOnly()

    expect(pbSend).toHaveBeenCalledWith(IPCP_DIARIO_READONLY_PATH, { method: 'GET' })
    expect(data.contrato).toBe('ipcp_diario_readonly_v0_2')
    expect(data.read_only).toBe(true)
    expect(data.sem_mutacao).toBe(true)
    expect(data.resumo_nexo.texto).toBe('Resposta do endpoint')
  })

  it('usa a fixture homologada se o endpoint ainda não estiver disponível', async () => {
    pbSend.mockRejectedValue(new Error('rota não materializada'))

    const data = await obterIpcpDiarioReadOnly()

    expect(data).toBe(ipcpDiarioFixtureHomologado)
    expect(data.read_only).toBe(true)
    expect(data.sem_mutacao).toBe(true)
  })
})
