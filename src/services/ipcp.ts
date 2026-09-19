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
  empresa?: string | null
  contato?: string | null
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
  atualizado_em?: string | null
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
    cenario?: string | null
    comentario: string
    acao_recomendada?: string | null
    total_atual?: number | null
    total_anterior?: number | null
    variacao_total?: number | null
    data_anterior?: string | null
    blocos?: Array<{
      id: IpcpBlocoId
      label: string
      atual: number
      anterior: number
      variacao: number
      status: 'sem_historico' | 'melhorou' | 'manteve' | 'piorou'
    }>
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
export function nexoIpcpDiarioVivoPath(
  escopo: 'proprio' | 'equipe' | 'todos' = 'proprio',
  responsavelId?: string | null,
) {
  const params = new URLSearchParams({ escopo })
  if (responsavelId) params.set('responsavel_id', responsavelId)
  return `${NEXO_IPCP_DIARIO_VIVO_PATH}?${params.toString()}`
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
  formula_version: 'ipcp_sem_leitura_viva_disponivel',
  data_referencia: '2026-09-18',
  atualizacao: 'diaria',
  resumo_nexo: {
    texto:
      'A leitura viva do IPCP ainda não está disponível para este escopo. Acione o processamento diário antes de usar o indicador como orientação operacional.',
    prioridades: [
      {
        titulo: 'Processar leitura viva do IPCP',
        motivo: 'Evita orientar a operação com referência fixa ou desatualizada.',
        bloco_afetado: 'registros_aprendizado',
      },
      {
        titulo: 'Conferir responsável e escopo',
        motivo: 'A carteira precisa ser lida pelo perfil correto antes da publicação operacional.',
        bloco_afetado: 'disciplina_carteira',
      },
      {
        titulo: 'Validar dados reais antes da publicação',
        motivo: 'Prioridades e negócios de atenção devem vir da carteira real consultada.',
        bloco_afetado: 'resultado_comercial',
      },
    ],
  },
  ipcp: {
    total: 0,
    blocos: {
      resultado_comercial: 0,
      valor_estrategico: 0,
      disciplina_carteira: 0,
      qualidade_followup: 0,
      registros_aprendizado: 0,
    },
    cobertura_ia: {
      avaliados: 0,
      total: 0,
      pendentes: 0,
    },
  },
  negocios_atencao: [],
  evolucao: {
    status: 'sem_historico',
    cenario: 'sem_historico',
    comentario: 'Sem leitura viva disponível para comparar evolução neste escopo.',
    acao_recomendada: 'Aguardar o próximo processamento diário para formar histórico comparável.',
    total_atual: 0,
    total_anterior: null,
    variacao_total: null,
    blocos: [],
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
    calculado_em?: string | null
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
    data.dados_vivos?.pacote_completo === true && temBlocosIpcpCompletos(data.ipcp)
  const prioridades = data.resumo?.recomendacoes?.length
    ? data.resumo.recomendacoes.map((item) => ({
        ...item,
        titulo: normalizarTextoProducaoAssistida(item.titulo),
        motivo: normalizarTextoProducaoAssistida(item.motivo),
      }))
    : []
  const prioridadesCompletas =
    snapshotCompleto && prioridades.length >= 3
      ? prioridades
      : [...prioridades, ...ipcpDiarioFixtureHomologado.resumo_nexo.prioridades].slice(0, 3)
  const textoBase =
    data.resumo?.texto || 'Leitura viva do IPCP da equipe disponível para orientação assistida.'
  const textoNormalizado = normalizarTextoProducaoAssistida(textoBase)
  const ipcpCompleto = snapshotCompleto && data.ipcp ? data.ipcp : ipcpDiarioFixtureHomologado.ipcp

  return {
    contrato: data.contrato,
    read_only: true,
    sem_mutacao: true,
    modo: data.modo,
    formula_version: data.formula_version,
    data_referencia: data.data_referencia,
    atualizado_em: data.dados_vivos?.calculado_em || data.data_referencia,
    atualizacao: 'diaria',
    escopo: data.escopo_efetivo,
    resumo_nexo: {
      texto: snapshotCompleto
        ? textoNormalizado
        : `${textoNormalizado} Enquanto o processamento diário não retorna o pacote completo, a tela mantém a última leitura completa aprovada para não deixar a operação sem orientação.`,
      prioridades: prioridadesCompletas,
    },
    ipcp: ipcpCompleto,
    negocios_atencao: snapshotCompleto ? data.negocios_atencao || [] : [],
    evolucao:
      snapshotCompleto && data.evolucao
        ? data.evolucao
        : {
            status: 'sem_historico',
            comentario:
              'Aguardando processamento diário completo; a tela mantém a última leitura aprovada da equipe até a nova carga viva ficar disponível.',
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
  responsavelId?: string | null,
): Promise<IpcpDiarioReadOnly> {
  const data = await pb.send<NexoIpcpDiarioVivoResponse>(
    nexoIpcpDiarioVivoPath(escopo, responsavelId),
    {
      method: 'GET',
    },
  )
  if (
    data?.contrato === 'nexo_ipcp_diario_v1' &&
    data?.read_only === true &&
    data?.sem_mutacao === true
  ) {
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
      cron_utc: '0 22 * * *',
      agendamento_automatico_ativo: true,
      producao_publicada: false,
      sem_crm_write: true,
      sem_envio: true,
    },
  }
}
