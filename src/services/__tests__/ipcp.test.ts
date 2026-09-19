import { beforeEach, describe, expect, it, vi } from 'vitest'

const pbSend = vi.hoisted(() => vi.fn())

vi.mock('@/lib/pocketbase/client', () => ({
  default: { send: pbSend },
}))

import {
  IPCP_DIARIO_READONLY_PATH,
  nexoIpcpDiarioVivoPath,
  IPCP_JOB_DIARIO_HOMOLOGACAO_STATUS_PATH,
  IPCP_PROCESSAMENTO_DIARIO_HOMOLOGACAO_PATH,
  IPCP_SIMULACAO_READONLY_PATH,
  IPCP_SNAPSHOT_SIMULADO_PATH,
  criarIpcpSnapshotSimulado,
  executarIpcpProcessamentoDiarioHomologacao,
  obterIpcpDiarioReadOnly,
  obterNexoIpcpDiarioEquipe,
  obterIpcpSimulacaoReadOnly,
  obterStatusIpcpJobDiarioHomologacao,
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

  it('consulta a leitura viva de equipe do Nexo e normaliza para o card da Operação do Dia', async () => {
    pbSend.mockResolvedValue({
      contrato: 'nexo_ipcp_diario_v1',
      read_only: true,
      sem_mutacao: true,
      modo: 'consulta_viva_controlada',
      fonte_dados: 'com_ipcp_snapshots',
      data_referencia: '2026-09-17',
      formula_version: 'ipcp_v0_2_simulacao_readonly_ia_followup',
      escopo_efetivo: {
        tipo: 'equipe',
        responsavel_id: 'lulamoura52022x',
        responsavel_nome: 'Luiz Antônio Moura',
        pode_ver_equipe: true,
        pode_ver_todos: true,
      },
      dados_vivos: {
        fonte_disponivel: true,
        snapshot_encontrado: true,
        total_lido: 2,
        pacote_completo: true,
      },
      resumo: {
        texto: 'Leitura viva da equipe em homologação com snapshot simulado.',
        recomendacoes: [
          {
            titulo: 'Ação de equipe',
            motivo: 'Prioridade baseada no snapshot vivo.',
            bloco_afetado: 'disciplina_carteira',
          },
        ],
      },
      ipcp: {
        total: 62.4,
        blocos: {
          resultado_comercial: 21,
          valor_estrategico: 11,
          disciplina_carteira: 12,
          qualidade_followup: 13,
          registros_aprendizado: 5.4,
        },
        cobertura_ia: {
          provider_oficial: 'nexo_hermes',
          fallback_permitido: false,
          avaliados: 70,
          total: 70,
          pendentes: 0,
        },
      },
      negocios_atencao: [
        {
          id_negocio: '9001',
          cliente: 'Cliente pacote completo',
          motivo: 'Negócio destacado pelo pacote diário completo.',
          acao_recomendada: 'Confirmar próximo passo e pendência comercial.',
          blocos_afetados: ['qualidade_followup'],
          link: '/pipeline?negocio=9001',
        },
      ],
      evolucao: {
        status: 'melhorou',
        comentario: 'IPCP melhorou em relação à leitura anterior (+4,2 ponto(s)).',
        total_atual: 62.4,
        total_anterior: 58.2,
        variacao_total: 4.2,
        data_anterior: '2026-09-16',
        blocos: [
          {
            id: 'resultado_comercial',
            label: 'Resultado comercial',
            atual: 21,
            anterior: 18,
            variacao: 3,
            status: 'melhorou',
          },
        ],
      },
      guardrails: {
        sem_ranking_punitivo: true,
        fallback_openai_bloqueado: true,
        provider_oficial_followup: 'nexo_hermes',
        sem_job_automatico: true,
      },
    })

    const data = await obterNexoIpcpDiarioEquipe()

    expect(pbSend).toHaveBeenCalledWith(nexoIpcpDiarioVivoPath('equipe'), { method: 'GET' })
    expect(data.contrato).toBe('nexo_ipcp_diario_v1')
    expect(data.read_only).toBe(true)
    expect(data.sem_mutacao).toBe(true)
    expect(data.escopo?.tipo).toBe('equipe')
    expect(data.resumo_nexo.texto).toBe(
      'Leitura viva da equipe em produção assistida com snapshot controlado.',
    )
    expect(data.resumo_nexo.prioridades[0].titulo).toBe('Ação de equipe')
    expect(data.ipcp.total).toBe(62.4)
    expect(data.negocios_atencao[0].id_negocio).toBe('9001')
    expect(data.evolucao.comentario).toMatch(/melhorou/)
    expect(data.evolucao.variacao_total).toBe(4.2)
    expect(data.evolucao.blocos?.[0].id).toBe('resultado_comercial')
  })

  it('mantém a Operação do Dia completa quando o snapshot vivo ainda não tem todos os blocos', async () => {
    pbSend.mockResolvedValue({
      contrato: 'nexo_ipcp_diario_v1',
      read_only: true,
      sem_mutacao: true,
      modo: 'consulta_viva_controlada',
      fonte_dados: 'com_ipcp_snapshots',
      data_referencia: '2026-09-18',
      formula_version: 'ipcp_v0_2_simulacao_readonly_ia_followup',
      escopo_efetivo: {
        tipo: 'equipe',
        responsavel_id: 'lulamoura52022x',
        responsavel_nome: 'Luiz Antônio Moura',
        pode_ver_equipe: true,
        pode_ver_todos: true,
      },
      dados_vivos: {
        fonte_disponivel: true,
        snapshot_encontrado: false,
        total_lido: 0,
      },
      resumo: {
        texto: 'Sem snapshot vivo do IPCP para este escopo na data consultada.',
        recomendacoes: [
          {
            titulo: 'Validar processamento vivo do IPCP',
            motivo:
              'Evita orientação gerencial baseada em dado desatualizado ou sem processamento.',
            bloco_afetado: 'registros_aprendizado',
          },
        ],
      },
      ipcp: {
        total: 0,
        blocos: {},
        cobertura_ia: {
          provider_oficial: 'nexo_hermes',
          fallback_permitido: false,
          avaliados: 0,
          total: 0,
          pendentes: 0,
        },
      },
      guardrails: {
        sem_ranking_punitivo: true,
        fallback_openai_bloqueado: true,
        provider_oficial_followup: 'nexo_hermes',
        sem_job_automatico: true,
      },
    })

    const data = await obterNexoIpcpDiarioEquipe()

    expect(data.ipcp.blocos).toEqual(ipcpDiarioFixtureHomologado.ipcp.blocos)
    expect(data.negocios_atencao.length).toBe(0)
    expect(data.resumo_nexo.prioridades.length).toBeGreaterThan(1)
    expect(data.resumo_nexo.texto).toMatch(/última leitura completa/i)
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
    pbSend.mockResolvedValue({
      ...ipcpDiarioFixtureHomologado,
      modo: 'simulacao',
      sem_mutacao: false,
    })

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

  it('executa processamento diário só em homologação e sem agendamento automático', async () => {
    pbSend.mockResolvedValue({
      ok: true,
      contrato: 'ipcp_processamento_diario_homologacao_v0_1',
      snapshot: {
        id: 'proc123',
        key: '2026-09-17|equipe|user|formula|processamento_diario',
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
      processamento_diario: {
        controlado: true,
        homologacao: true,
        agendamento_automatico_ativo: false,
        producao_publicada: false,
      },
    })

    const data = await executarIpcpProcessamentoDiarioHomologacao()

    expect(pbSend).toHaveBeenCalledWith(IPCP_PROCESSAMENTO_DIARIO_HOMOLOGACAO_PATH, {
      method: 'POST',
      body: {
        confirmacao: 'EXECUTAR_PROCESSAMENTO_DIARIO_IPCP_HOMOLOGACAO',
        escopo: 'equipe',
      },
    })
    expect(data.processamento_diario?.agendamento_automatico_ativo).toBe(false)
    expect(data.processamento_diario?.producao_publicada).toBe(false)
  })

  it('consulta o status do job diário de homologação', async () => {
    pbSend.mockResolvedValue({
      ok: true,
      job: {
        ativo: true,
        ambiente: 'homologacao_preview',
        horario_recife: '19:00',
        cron_utc: '0 22 * * *',
        agendamento_automatico_ativo: true,
        producao_publicada: false,
        sem_crm_write: true,
        sem_envio: true,
      },
    })

    const data = await obterStatusIpcpJobDiarioHomologacao()

    expect(pbSend).not.toHaveBeenCalledWith(IPCP_JOB_DIARIO_HOMOLOGACAO_STATUS_PATH, {
      method: 'GET',
    })
    expect(data.job.ativo).toBe(true)
    expect(data.job.producao_publicada).toBe(false)
    expect(data.job.sem_crm_write).toBe(true)
  })
})
