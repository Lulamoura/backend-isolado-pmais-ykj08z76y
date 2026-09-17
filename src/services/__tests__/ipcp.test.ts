import { beforeEach, describe, expect, it, vi } from 'vitest'

const pbSend = vi.hoisted(() => vi.fn())

vi.mock('@/lib/pocketbase/client', () => ({
  default: { send: pbSend },
}))

import {
  IPCP_DIARIO_READONLY_PATH,
  IPCP_SIMULACAO_READONLY_PATH,
  IPCP_SNAPSHOT_SIMULADO_PATH,
  criarIpcpSnapshotSimulado,
  obterIpcpDiarioReadOnly,
  obterIpcpSimulacaoReadOnly,
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

  it('consulta a simulação read-only com evidências e escopo de equipe', async () => {
    pbSend.mockResolvedValue({
      ...ipcpDiarioFixtureHomologado,
      modo: 'simulacao',
      simulacao: {
        ativa: true,
        colecao_snapshot_criada: false,
        gravacao_snapshot_realizada: false,
        job_automatico_ativo: false,
      },
    })

    const data = await obterIpcpSimulacaoReadOnly()

    expect(pbSend).toHaveBeenCalledWith(
      `${IPCP_SIMULACAO_READONLY_PATH}?incluir_evidencias=true&escopo=equipe`,
      { method: 'GET' },
    )
    expect(data.modo).toBe('simulacao')
    expect(data.simulacao?.gravacao_snapshot_realizada).toBe(false)
  })

  it('rejeita simulação sem garantias read-only', async () => {
    pbSend.mockResolvedValue({ ...ipcpDiarioFixtureHomologado, modo: 'simulacao', sem_mutacao: false })

    await expect(obterIpcpSimulacaoReadOnly()).rejects.toThrow(/read-only/i)
  })

  it('grava snapshot simulado somente com confirmação explícita e guardrails', async () => {
    pbSend.mockResolvedValue({
      ok: true,
      contrato: 'ipcp_snapshot_simulado_v0_1',
      snapshot: {
        id: 'snap123',
        key: '2026-09-17|equipe|user|formula|simulado',
        modo: 'simulado',
        status: 'homologacao',
        data_referencia: '2026-09-17',
        escopo: 'equipe',
      },
      simulacao: {
        ativa: true,
        colecao_snapshot_criada: true,
        gravacao_snapshot_realizada: true,
        job_automatico_ativo: false,
      },
      guardrails: {
        sem_ranking_punitivo: true,
        fallback_openai_bloqueado: true,
        sem_envio: true,
        sem_crm_write: true,
        sem_job_automatico: true,
        somente_colecao_snapshot: true,
        homologacao_preview: true,
      },
    })

    const data = await criarIpcpSnapshotSimulado()

    expect(pbSend).toHaveBeenCalledWith(IPCP_SNAPSHOT_SIMULADO_PATH, {
      method: 'POST',
      body: {
        confirmacao: 'CRIAR_SNAPSHOT_SIMULADO_IPCP',
        escopo: 'equipe',
      },
    })
    expect(data.snapshot.status).toBe('homologacao')
    expect(data.simulacao.gravacao_snapshot_realizada).toBe(true)
    expect(data.simulacao.job_automatico_ativo).toBe(false)
  })
})
