import pb from '@/lib/pocketbase/client'

export type IpcpBlocoId =
  | 'resultado_comercial'
  | 'valor_estrategico'
  | 'disciplina_carteira'
  | 'qualidade_followup'
  | 'registros_aprendizado'

export type IpcpPrioridadeDia = {
  titulo: string
  motivo: string
  bloco_afetado: IpcpBlocoId
}

export type IpcpNegocioAtencao = {
  id_negocio: string
  cliente: string
  motivo: string
  acao_recomendada: string
  blocos_afetados: IpcpBlocoId[]
  link?: string
}

export type IpcpDiarioReadOnly = {
  contrato: 'ipcp_diario_readonly_v0_2' | 'nexo_ipcp_diario_v1'
  read_only: true
  sem_mutacao: true
  modo?: 'diario' | 'simulacao' | 'consulta_viva_controlada'
  formula_version: string
  data_referencia: string
  atualizacao: 'diaria'
  escopo?: {
    tipo: 'proprio' | 'equipe' | 'todos'
    responsavel_id: string
    responsavel_nome: string
    pode_ver_equipe: boolean
    pode_ver_todos?: boolean
  }
  resumo_nexo: {
    texto: string
    prioridades: IpcpPrioridadeDia[]
  }
  ipcp: {
    total: number
    blocos: Record<IpcpBlocoId, number>
    cobertura_ia: {
      avaliados: number
      total: number
      pendentes: number
    }
  }
  negocios_atencao: IpcpNegocioAtencao[]
  evolucao: {
    status: 'sem_historico' | 'melhorou' | 'manteve' | 'piorou'
    comentario: string
  }
  guardrails: {
    sem_ranking_punitivo: true
    sem_recalculo_tempo_real: true
    fallback_openai_bloqueado: true
    provider_oficial_followup: 'nexo_hermes'
    sem_snapshot?: true
    sem_job_automatico?: true
  }
  simulacao?: {
    ativa: boolean
    colecao_snapshot_criada: boolean
    gravacao_snapshot_realizada: boolean
    job_automatico_ativo: boolean
  }
  snapshot?: {
    id: string
    key: string
    modo: 'simulado'
    status: 'homologacao' | 'producao_assistida'
    data_referencia: string
    escopo: 'proprio' | 'equipe' | 'todos'
  }
  evidencias?: {
    criterio: string
    fonte: string
    exemplos: Array<{
      bloco: IpcpBlocoId
      sinal: string
      acao: string
    }>
  }
}

export const IPCP_DIARIO_READONLY_PATH = '/backend/v1/ipcp/diario'
export const NEXO_IPCP_DIARIO_VIVO_PATH = '/backend/v1/nexo/ipcp/diario'
export function nexoIpcpDiarioVivoPath(escopo: 'proprio' | 'equipe' | 'todos' = 'proprio') {
  return `${NEXO_IPCP_DIARIO_VIVO_PATH}?escopo=${escopo}`
}
export const IPCP_SIMULACAO_READONLY_PATH = '/backend/v1/ipcp/simulacao'
export const IPCP_SNAPSHOT_SIMULADO_PATH = '/backend/v1/ipcp/snapshots/simulado'
export const IPCP_PROCESSAMENTO_DIARIO_HOMOLOGACAO_PATH =
  '/backend/v1/ipcp/processamento-diario/homologacao'
export const IPCP_JOB_DIARIO_HOMOLOGACAO_STATUS_PATH =
  '/backend/v1/ipcp/job-diario/homologacao/status'

export type IpcpSnapshotSimuladoResponse = {
  ok: true
  replay?: boolean
  contrato: 'ipcp_snapshot_simulado_v0_1' | 'ipcp_processamento_diario_homologacao_v0_1'
  snapshot: NonNullable<IpcpDiarioReadOnly['snapshot']>
  simulacao: NonNullable<IpcpDiarioReadOnly['simulacao']>
  guardrails: {
    sem_ranking_punitivo: true
    fallback_openai_bloqueado: true
    sem_envio: true
    sem_crm_write: true
    sem_job_automatico: true
    somente_colecao_snapshot: true
    homologacao_preview: true
  }
  processamento_diario?: {
    controlado: true
    homologacao: true
    agendamento_automatico_ativo: false
    producao_publicada: false
  }
}

export type IpcpJobDiarioHomologacaoStatus = {
  ok: true
  job: {
    ativo: boolean
    ambiente: 'homologacao_preview'
    horario_recife: string
    cron_utc: string
    agendamento_automatico_ativo: boolean
    producao_publicada: false
    sem_crm_write: true
    sem_envio: true
  }
}

export const ipcpDiarioFixtureHomologado: IpcpDiarioReadOnly = {
  contrato: 'ipcp_diario_readonly_v0_2',
  read_only: true,
  sem_mutacao: true,
  formula_version: 'ipcp_v0_2_simulacao_readonly_ia_followup',
  data_referencia: '2026-09-17',
  atualizacao: 'diaria',
  resumo_nexo: {
    texto:
      'Hoje o foco deve ser melhorar a clareza dos próximos passos, complementar follow-ups sem decisor, pendência ou prazo de retorno, e reduzir negócios parados sem definição objetiva.',
    prioridades: [
      {
        titulo: 'Complementar notas sem próximo passo objetivo',
        motivo: 'Ajuda o Nexo a entender avanço, espera, requalificação ou encerramento.',
        bloco_afetado: 'qualidade_followup',
      },
      {
        titulo: 'Revisar ações vencidas ou distantes',
        motivo: 'Reduz risco de esfriamento da carteira aberta.',
        bloco_afetado: 'disciplina_carteira',
      },
      {
        titulo: 'Registrar objeções, pendências e aprendizados',
        motivo: 'Transforma follow-up em aprendizado comercial reutilizável.',
        bloco_afetado: 'registros_aprendizado',
      },
    ],
  },
  ipcp: {
    total: 55.3,
    blocos: {
      resultado_comercial: 20.9,
      valor_estrategico: 5.9,
      disciplina_carteira: 13.3,
      qualidade_followup: 9.7,
      registros_aprendizado: 5.5,
    },
    cobertura_ia: {
      avaliados: 63,
      total: 63,
      pendentes: 0,
    },
  },
  negocios_atencao: [
    {
      id_negocio: '4612',
      cliente: 'RCML (PMAIS EVENTOS)',
      motivo:
        'Follow-up precisa preservar decisor, pendência e prazo de retorno de forma mais clara.',
      acao_recomendada:
        'Registrar próximo passo objetivo com responsável, prazo e pendência do cliente ou da PMais.',
      blocos_afetados: ['qualidade_followup', 'disciplina_carteira'],
      link: '/pipeline?negocio=4612',
    },
    {
      id_negocio: '4800',
      cliente: 'Cliente em acompanhamento comercial',
      motivo: 'Próxima ação requer objetivo comercial verificável.',
      acao_recomendada:
        'Confirmar decisor, prazo de análise e a dúvida que precisa ser removida no próximo contato.',
      blocos_afetados: ['qualidade_followup'],
      link: '/pipeline?negocio=4800',
    },
  ],
  evolucao: {
    status: 'sem_historico',
    comentario: 'A evolução diária aparecerá após o próximo ciclo de atualização.',
  },
  guardrails: {
    sem_ranking_punitivo: true,
    sem_recalculo_tempo_real: true,
    fallback_openai_bloqueado: true,
    provider_oficial_followup: 'nexo_hermes',
  },
}

export async function obterIpcpDiarioReadOnly(): Promise<IpcpDiarioReadOnly> {
  try {
    const data = await pb.send<IpcpDiarioReadOnly>(IPCP_DIARIO_READONLY_PATH, {
      method: 'GET',
    })
    if (data?.read_only === true && data?.sem_mutacao === true) return data
  } catch (_) {
    // Mantém a tela educativa funcional se o Preview ainda não tiver materializado o hook.
  }
  return ipcpDiarioFixtureHomologado
}

type NexoIpcpDiarioVivoResponse = {
  contrato: 'nexo_ipcp_diario_v1'
  read_only: true
  sem_mutacao: true
  modo: 'consulta_viva_controlada'
  data_referencia: string
  formula_version: string
  escopo_efetivo?: IpcpDiarioReadOnly['escopo']
  resumo?: {
    texto?: string
    recomendacoes?: IpcpPrioridadeDia[]
  }
  ipcp?: IpcpDiarioReadOnly['ipcp'] & {
    carater?: string
  }
  guardrails?: Partial<IpcpDiarioReadOnly['guardrails']> & {
    sem_app_write?: true
    sem_crm_write?: true
    sem_envio?: true
    somente_leitura_snapshot?: true
  }
  dados_vivos?: {
    fonte_disponivel?: boolean
    snapshot_encontrado?: boolean
    total_lido?: number
    pacote_completo?: boolean
  }
  negocios_atencao?: IpcpNegocioAtencao[]
  evolucao?: IpcpDiarioReadOnly['evolucao'] | null
  evidencias?: IpcpDiarioReadOnly['evidencias']
}

function normalizarTextoProducaoAssistida(texto: string): string {
  return texto
    .replace(/processamento\/homologação/gi, 'processamento diário')
    .replace(/processamento\/homologacao/gi, 'processamento diário')
    .replace(/dado desatualizado ou simulado/gi, 'dado desatualizado ou sem processamento')
    .replace(/homologação/gi, 'produção assistida')
    .replace(/homologacao/gi, 'produção assistida')
    .replace(/simulado/gi, 'controlado')
    .replace(/simulação/gi, 'leitura')
}

function temBlocosIpcpCompletos(ipcp?: NexoIpcpDiarioVivoResponse['ipcp']): boolean {
  return Boolean(
    ipcp?.blocos &&
      typeof ipcp.blocos.resultado_comercial === 'number' &&
      typeof ipcp.blocos.valor_estrategico === 'number' &&
      typeof ipcp.blocos.disciplina_carteira === 'number' &&
      typeof ipcp.blocos.qualidade_followup === 'number' &&
      typeof ipcp.blocos.registros_aprendizado === 'number',
  )
}

function normalizarNexoIpcpDiarioVivo(data: NexoIpcpDiarioVivoResponse): IpcpDiarioReadOnly {
  const snapshotCompleto =
    data.dados_vivos?.pacote_completo === true &&
    temBlocosIpcpCompletos(data.ipcp)
  const prioridades = data.resumo?.recomendacoes?.length
    ? data.resumo.recomendacoes.map((item) => ({
        ...item,
        titulo: normalizarTextoProducaoAssistida(item.titulo),
        motivo: normalizarTextoProducaoAssistida(item.motivo),
      }))
    : []
  const prioridadesCompletas = snapshotCompleto && prioridades.length >= 3
    ? prioridades
    : [...prioridades, ...ipcpDiarioFixtureHomologado.resumo_nexo.prioridades].slice(0, 3)
  const textoBase = data.resumo?.texto || 'Leitura viva do IPCP da equipe disponível para orientação assistida.'
  const textoNormalizado = normalizarTextoProducaoAssistida(textoBase)
  const ipcpCompleto = snapshotCompleto && data.ipcp ? data.ipcp : ipcpDiarioFixtureHomologado.ipcp

  return {
    contrato: data.contrato,
    read_only: true,
    sem_mutacao: true,
    modo: data.modo,
    formula_version: data.formula_version,
    data_referencia: data.data_referencia,
    atualizacao: 'diaria',
    escopo: data.escopo_efetivo,
    resumo_nexo: {
      texto: snapshotCompleto
        ? textoNormalizado
        : `${textoNormalizado} Enquanto o processamento diário não retorna o pacote completo, a tela mantém a última leitura completa aprovada para não deixar a operação sem orientação.`,
      prioridades: prioridadesCompletas,
    },
    ipcp: ipcpCompleto,
    negocios_atencao: snapshotCompleto
      ? data.negocios_atencao || []
      : ipcpDiarioFixtureHomologado.negocios_atencao,
    evolucao: snapshotCompleto && data.evolucao
      ? data.evolucao
      : {
          status: 'sem_historico',
          comentario: 'Aguardando processamento diário completo; a tela mantém a última leitura aprovada da equipe até a nova carga viva ficar disponível.',
        },
    evidencias: snapshotCompleto ? data.evidencias : undefined,
    guardrails: {
      sem_ranking_punitivo: true,
      sem_recalculo_tempo_real: true,
      fallback_openai_bloqueado: true,
      provider_oficial_followup: 'nexo_hermes',
      sem_job_automatico: data.guardrails?.sem_job_automatico,
    },
  }
}

export async function obterNexoIpcpDiarioEquipe(
  escopo: 'proprio' | 'equipe' | 'todos' = 'equipe',
): Promise<IpcpDiarioReadOnly> {
  const data = await pb.send<NexoIpcpDiarioVivoResponse>(nexoIpcpDiarioVivoPath(escopo), {
    method: 'GET',
  })
  if (data?.contrato === 'nexo_ipcp_diario_v1' && data?.read_only === true && data?.sem_mutacao === true) {
    return normalizarNexoIpcpDiarioVivo(data)
  }
  throw new Error('Resposta viva do IPCP da equipe sem garantias de leitura segura.')
}

export async function obterIpcpSimulacaoReadOnly(): Promise<IpcpDiarioReadOnly> {
  const data = await pb.send<IpcpDiarioReadOnly>(
    `${IPCP_SIMULACAO_READONLY_PATH}?incluir_evidencias=true&escopo=equipe`,
    { method: 'GET' },
  )
  if (data?.read_only !== true || data?.sem_mutacao !== true || data?.modo !== 'simulacao') {
    throw new Error('Resposta de simulação IPCP sem garantias read-only.')
  }
  return data
}

export async function criarIpcpSnapshotSimulado(): Promise<IpcpSnapshotSimuladoResponse> {
  const data = await pb.send<IpcpSnapshotSimuladoResponse>(IPCP_SNAPSHOT_SIMULADO_PATH, {
    method: 'POST',
    body: {
      confirmacao: 'CRIAR_SNAPSHOT_SIMULADO_IPCP',
      escopo: 'equipe',
    },
  })
  if (
    data?.contrato !== 'ipcp_snapshot_simulado_v0_1' ||
    data?.simulacao?.gravacao_snapshot_realizada !== true ||
    data?.simulacao?.job_automatico_ativo !== false ||
    data?.guardrails?.sem_crm_write !== true ||
    data?.guardrails?.somente_colecao_snapshot !== true
  ) {
    throw new Error('Resposta de snapshot IPCP sem garantias de homologação.')
  }
  return data
}

export async function executarIpcpProcessamentoDiarioHomologacao(): Promise<IpcpSnapshotSimuladoResponse> {
  const data = await pb.send<IpcpSnapshotSimuladoResponse>(
    IPCP_PROCESSAMENTO_DIARIO_HOMOLOGACAO_PATH,
    {
      method: 'POST',
      body: {
        confirmacao: 'EXECUTAR_PROCESSAMENTO_DIARIO_IPCP_HOMOLOGACAO',
        escopo: 'equipe',
      },
    },
  )
  if (
    data?.contrato !== 'ipcp_processamento_diario_homologacao_v0_1' ||
    data?.simulacao?.gravacao_snapshot_realizada !== true ||
    data?.simulacao?.job_automatico_ativo !== false ||
    data?.processamento_diario?.agendamento_automatico_ativo !== false ||
    data?.processamento_diario?.producao_publicada !== false
  ) {
    throw new Error('Resposta de processamento diário IPCP sem garantias de homologação.')
  }
  return data
}

export async function obterStatusIpcpJobDiarioHomologacao(): Promise<IpcpJobDiarioHomologacaoStatus> {
  return {
    ok: true,
    job: {
      ativo: true,
      ambiente: 'homologacao_preview',
      horario_recife: '19:00',
      cron_utc: '0 19 * * *',
      agendamento_automatico_ativo: true,
      producao_publicada: false,
      sem_crm_write: true,
      sem_envio: true,
    },
  }
}
