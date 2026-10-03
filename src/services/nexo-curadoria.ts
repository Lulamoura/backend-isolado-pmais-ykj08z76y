import pb from '@/lib/pocketbase/client'

export interface NexoCuradoriaEvento {
  id: string
  tipo_evento?: string
  external_id?: string
  negocio_titulo?: string
  empresa_nome?: string
  contato_nome?: string
  acao?: string
  contexto_resumo?: string
  resposta_resumo?: string
  motivo_curadoria?: string
  responsavel_nome?: string
  tempo_vida_negocio?: string
  data_criacao_negocio?: string
  triagem_status?: string
  avaliacao_negocio_resumo?: string
  gatilhos_curadoria?: string
  regra_pratica_relacionada?: string
  evidencia_curadoria?: string
  impacto_ipcp_potencial?: boolean
  audit_id?: string
  created_at?: string
  created?: string
  human_review_required?: boolean
  segundo_cerebro_usado?: boolean
  fallback?: boolean
  eventos_relacionados?: NexoCuradoriaEvento[]
  total_consultas?: number
  acoes_relacionadas?: string[]
  notas_followups?: NexoCuradoriaNota[]
}

export interface NexoCuradoriaNota {
  id: string
  texto: string
  autor_external_id?: string | null
  autor_nome?: string | null
  criada_em?: string | null
  alterada_em?: string | null
}

interface NexoCuradoriaContextoNegocio {
  negocio?: { descricao_negocio?: string | null }
  campos_crm?: {
    descricao_negocio?: string | null
    detalhamento_proposta?: string | null
  }
  notas_followups?: NexoCuradoriaNota[]
}

export interface NexoCuradoriaResumo {
  pendencias: number
  itens: NexoCuradoriaEvento[]
}

export interface ImpactoDecisaoCuradoria {
  altera_funil: boolean
  altera_risco: boolean
  altera_perda: boolean
  altera_indicador: boolean
  altera_politica_comercial: boolean
}

export interface NexoCuradoriaDecisaoSuperior {
  id: string
  evento_id?: string
  entrevista_id?: string
  external_id?: string
  empresa_nome?: string
  contato_nome?: string
  negocio_titulo?: string
  status?: string
  nivel_decisao?: string
  escalar_direcao?: boolean
  regra_proposta?: string
  excecao_condicao?: string
  responsavel_validacao?: string
  impacto_json?: string
  origem_respostas_json?: string
  usuario_nome?: string
  decisao_observacao?: string
  segundo_cerebro_status?: string
  segundo_cerebro_audit_id?: string
  segundo_cerebro_atualizado_em?: string
  ipcp_revisao_status?: string
  ipcp_revisao_blocos?: string
  ipcp_revisao_motivo?: string
  ipcp_revisao_notificado_em?: string
  ipcp_formula_versao_id?: string
  ipcp_formula_versao?: string
  ipcp_formula_aplicada_em?: string
  ipcp_formula_audit_json?: string
  updated_at?: string
  created_at?: string
  created?: string
}

export type AcaoCasoCuradoriaComercial =
  | 'salvar_rascunho'
  | 'encaminhar_gestao'
  | 'encaminhar_direcao'
  | 'aprovar'
  | 'rejeitar'
  | 'retirar'
  | 'reabrir'

export interface CasoCuradoriaComercial {
  id: string
  revisao: number
  status: string
  fonte_principal: string
  fontes: string[]
  empresa_nome?: string | null
  contato_nome?: string | null
  negocio_numero?: string | null
  negocio_titulo?: string | null
  responsavel_nome?: string | null
  assunto_chave: string
  titulo: string
  resumo_factual: string
  motivo_curadoria: string
  regra_candidata?: string | null
  evidencia_contagem: number
  recorrencia_contagem: number
  risco_classe: string
  alcada: 'gestao_comercial' | 'direcao' | string
  sensivel_motivos: string[]
  confianca: string
  human_review_required: boolean
  automatic_promotion_allowed: boolean
  entrevista_respostas: string[]
  entrevista_etapa: number
  decisao_observacao?: string | null
  conhecimento_status: string
  reabertura_elegivel?: boolean
  last_seen_at?: string | null
  decisao_em?: string | null
}

export interface CuradoriaComercialVisoes {
  para_tratar: CasoCuradoriaComercial[]
  aguardando_decisao: CasoCuradoriaComercial[]
  conhecimento_aprovado: CasoCuradoriaComercial[]
  historico: CasoCuradoriaComercial[]
}

export interface CuradoriaComercialResponse {
  ok: boolean
  visoes: CuradoriaComercialVisoes
  contadores: Record<keyof CuradoriaComercialVisoes, number>
  guardrails: {
    sem_payload_bruto: boolean
    sem_ids_tecnicos_visiveis: boolean
    automatic_send_allowed: boolean
  }
}

export interface TransicionarCasoCuradoriaComercialInput {
  acao: AcaoCasoCuradoriaComercial
  expected_revision: number
  regra_candidata?: string
  decisao_observacao?: string
  entrevista_respostas?: string[]
  entrevista_etapa?: number
}

export interface TransicionarCasoCuradoriaComercialResponse {
  ok: boolean
  idempotent_replay?: boolean
  caso: CasoCuradoriaComercial
  automatic_send_allowed: boolean
  promocao_automatica_realizada?: boolean
}

export async function listarCasosCuradoriaComercial(limite = 50) {
  const limiteSeguro = Math.max(1, Math.min(100, Math.floor(limite || 50)))
  return pb.send<CuradoriaComercialResponse>('/backend/v1/nexo/curadoria/casos/listar', {
    method: 'POST',
    body: { limite: limiteSeguro },
  })
}

export async function transicionarCasoCuradoriaComercial(
  casoId: string,
  input: TransicionarCasoCuradoriaComercialInput,
) {
  const id = String(casoId || '').trim()
  if (!id) throw new Error('CASO_CURADORIA_INVALIDO')
  return pb.send<TransicionarCasoCuradoriaComercialResponse>(
    `/backend/v1/nexo/curadoria/casos/${encodeURIComponent(id)}/transicionar`,
    {
      method: 'POST',
      body: input,
    },
  )
}

const COLLECTION = 'com_nexo_aprendizado_eventos'
const ENTREVISTAS_COLLECTION = 'com_nexo_curadoria_entrevistas'
const DECISOES_COLLECTION = 'com_nexo_curadoria_decisoes'
const PENDING_FILTER = "triagem_status = 'curadoria_necessaria' && human_review_required = true"

function pbValor(valor?: string) {
  return String(valor || '').replace(/'/g, "\\'")
}

function filtroDecisaoExistente(evento: NexoCuradoriaEvento) {
  const filtros = [`evento_id = '${pbValor(evento.id)}'`]
  if (evento.external_id) filtros.push(`external_id = '${pbValor(evento.external_id)}'`)
  return `(${filtros.join(' || ')})`
}

function decisaoOuEntrevistaExistente(
  decisao: NexoCuradoriaDecisaoSuperior | null,
  entrevista: unknown,
) {
  return Boolean(decisao || entrevista)
}

function eventoTimestamp(evento: NexoCuradoriaEvento) {
  const valor = evento.created_at || evento.created || ''
  const data = new Date(valor.replace(' ', 'T')).getTime()
  return Number.isNaN(data) ? 0 : data
}

function chaveCuradoriaEvento(evento: NexoCuradoriaEvento) {
  return evento.external_id ? `negocio:${evento.external_id}` : `evento:${evento.id}`
}

function rotuloAcaoCuradoria(acao?: string) {
  return (acao || 'consulta do Nexo').replace(/_/g, ' ')
}

function motivoCuradoriaPadrao(evento: NexoCuradoriaEvento) {
  const motivoRegistrado = String(evento.motivo_curadoria || '').trim()
  if (motivoRegistrado) return motivoRegistrado
  const avaliacao = String(evento.avaliacao_negocio_resumo || '').trim()
  if (avaliacao) return avaliacao
  return ''
}

function eventoCuradoriaQualificado(evento: NexoCuradoriaEvento) {
  return Boolean(
    String(evento.motivo_curadoria || '').trim() ||
    String(evento.evidencia_curadoria || '').trim() ||
    String(evento.regra_pratica_relacionada || '').trim() ||
    String(evento.gatilhos_curadoria || '').trim() ||
    String(evento.avaliacao_negocio_resumo || '').trim(),
  )
}

function consolidarEventosAguardandoCuradoria(eventos: NexoCuradoriaEvento[]) {
  const grupos = new Map<string, NexoCuradoriaEvento[]>()
  eventos.forEach((evento) => {
    const chave = chaveCuradoriaEvento(evento)
    grupos.set(chave, [...(grupos.get(chave) || []), evento])
  })

  return Array.from(grupos.values())
    .map((grupo) => {
      const ordenados = [...grupo].sort((a, b) => eventoTimestamp(b) - eventoTimestamp(a))
      const principal = { ...ordenados[0] }
      const acoes = Array.from(new Set(ordenados.map((evento) => rotuloAcaoCuradoria(evento.acao))))
      principal.eventos_relacionados = ordenados
      principal.total_consultas = ordenados.length
      principal.acoes_relacionadas = acoes
      principal.motivo_curadoria = motivoCuradoriaPadrao(principal)
      if (ordenados.length > 1) {
        const resumoConsultas = ordenados
          .map((evento) => {
            const data = evento.created_at || evento.created || 'sem data'
            const acao = rotuloAcaoCuradoria(evento.acao)
            return `- ${acao} em ${data}`
          })
          .join('\n')
        principal.motivo_curadoria = motivoCuradoriaPadrao(principal)
        principal.contexto_resumo = [
          `Resumo consolidado: ${ordenados.length} pedidos de ajuda do Nexo para o mesmo negócio.`,
          `Ações agrupadas: ${acoes.join(' | ')}.`,
          'Consultas que originaram esta curadoria:',
          resumoConsultas,
          '',
          'Contexto mais recente:',
          principal.contexto_resumo || '',
        ]
          .filter(Boolean)
          .join('\n')
      }
      return principal
    })
    .sort((a, b) => eventoTimestamp(b) - eventoTimestamp(a))
}

async function buscarContextoNegocioCuradoriaNexo(externalId: string) {
  return pb.send<NexoCuradoriaContextoNegocio>(`/backend/v1/nexo/negocios/${externalId}/contexto`, {
    method: 'GET',
  })
}

function aplicarDescricaoCrmAoContexto(evento: NexoCuradoriaEvento, descricaoCrm: string) {
  if (!descricaoCrm || !evento.contexto_resumo) return evento
  return {
    ...evento,
    contexto_resumo: evento.contexto_resumo.replace(
      /^Descrição: não informada$/gim,
      `Descrição: ${descricaoCrm}`,
    ),
  }
}

async function enriquecerEventosComDescricaoCrm(eventos: NexoCuradoriaEvento[]) {
  return Promise.all(
    eventos.map(async (evento) => {
      if (!evento.external_id) return evento
      try {
        const contexto = await buscarContextoNegocioCuradoriaNexo(evento.external_id)
        const descricaoCrm =
          contexto.campos_crm?.descricao_negocio ||
          contexto.negocio?.descricao_negocio ||
          contexto.campos_crm?.detalhamento_proposta ||
          ''
        return {
          ...aplicarDescricaoCrmAoContexto(evento, descricaoCrm),
          notas_followups: contexto.notas_followups || [],
        }
      } catch (_) {
        return evento
      }
    }),
  )
}

function decisaoHomologacao(decisao: NexoCuradoriaDecisaoSuperior) {
  const texto = [decisao.external_id, decisao.evento_id, decisao.negocio_titulo]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return texto.includes('homologacao-') || texto.includes('homologação')
}

async function buscarEntrevistaExistenteCuradoriaNexo(evento: NexoCuradoriaEvento) {
  try {
    return await pb
      .collection(ENTREVISTAS_COLLECTION)
      .getFirstListItem(filtroDecisaoExistente(evento), {
        sort: '-created_at',
      })
  } catch (error: any) {
    if (error?.status === 404 || error?.status === 403) return null
    throw error
  }
}

async function filtrarEventosAguardandoCuradoria(eventos: NexoCuradoriaEvento[]) {
  const pares = await Promise.all(
    eventos.map(async (evento) => {
      const [decisao, entrevista] = await Promise.all([
        buscarDecisaoSuperiorExistenteCuradoriaNexo(evento),
        buscarEntrevistaExistenteCuradoriaNexo(evento),
      ])
      return { evento, decisao, entrevista }
    }),
  )

  return pares
    .filter(({ decisao, entrevista }) => !decisaoOuEntrevistaExistente(decisao, entrevista))
    .map(({ evento }) => evento)
}

export async function obterResumoCuradoriaNexo(limit = 5): Promise<NexoCuradoriaResumo> {
  const response = await pb
    .collection(COLLECTION)
    .getList<NexoCuradoriaEvento>(1, Math.max(limit * 8, 200), {
      filter: PENDING_FILTER,
      sort: '-created_at',
    })
  const eventosAbertos = await filtrarEventosAguardandoCuradoria(
    response.items.filter(eventoCuradoriaQualificado),
  )
  const itensConsolidados = await enriquecerEventosComDescricaoCrm(
    consolidarEventosAguardandoCuradoria(eventosAbertos),
  )

  return {
    pendencias: itensConsolidados.length,
    itens: itensConsolidados.slice(0, limit),
  }
}

export async function listarNotasCuradoriaNexo(externalId: string) {
  const contexto = await buscarContextoNegocioCuradoriaNexo(externalId)
  return contexto.notas_followups || []
}

export async function obterDecisoesSuperioresCuradoriaNexo(limit = 10) {
  try {
    const response = await pb
      .collection(DECISOES_COLLECTION)
      .getList<NexoCuradoriaDecisaoSuperior>(1, limit, {
        filter: "status = 'aguardando_revisao'",
        sort: '-created_at',
      })

    return response.items.filter((decisao) => !decisaoHomologacao(decisao))
  } catch (error: any) {
    if (error?.status === 403) return []
    throw error
  }
}

export async function obterHistoricoDecisoesSuperioresCuradoriaNexo(limit = 20) {
  try {
    const response = await pb
      .collection(DECISOES_COLLECTION)
      .getList<NexoCuradoriaDecisaoSuperior>(1, limit, {
        filter: "status = 'aprovada_uso_operacional' || status = 'rejeitada'",
        sort: '-updated_at,-created_at',
      })

    return response.items.filter((decisao) => !decisaoHomologacao(decisao))
  } catch (error: any) {
    if (error?.status === 403) return []
    throw error
  }
}

export async function obterRevisoesIpcpPendentesCuradoriaNexo(limit = 10) {
  try {
    const response = await pb
      .collection(DECISOES_COLLECTION)
      .getList<NexoCuradoriaDecisaoSuperior>(1, Math.max(limit * 3, limit), {
        filter: "status = 'aprovada_uso_operacional'",
        sort: '-updated_at,-created_at',
      })

    return response.items
      .filter((decisao) => !decisaoHomologacao(decisao))
      .filter((decisao) => {
        const status = decisao.ipcp_revisao_status || 'pendente'
        return (
          status === 'pendente' ||
          status === 'ajuste_solicitado' ||
          status === 'alteracao_formula_aprovada' ||
          status === 'estudo_autorizado'
        )
      })
      .filter(decisaoPodeImpactarIpcp)
      .slice(0, limit)
  } catch (error: any) {
    if (error?.status === 403 || error?.status === 404) return []
    throw error
  }
}

export function impactoDecisaoSuperior(
  decisao: NexoCuradoriaDecisaoSuperior,
): ImpactoDecisaoCuradoria {
  try {
    return JSON.parse(decisao.impacto_json || '{}')
  } catch (_) {
    return {
      altera_funil: false,
      altera_risco: false,
      altera_perda: false,
      altera_indicador: false,
      altera_politica_comercial: false,
    }
  }
}

export function decisaoPodeImpactarIpcp(decisao: NexoCuradoriaDecisaoSuperior) {
  const impacto = impactoDecisaoSuperior(decisao)
  const texto = [
    decisao.regra_proposta,
    decisao.excecao_condicao,
    decisao.decisao_observacao,
    decisao.responsavel_validacao,
  ]
    .join(' ')
    .toLowerCase()

  return Boolean(
    impacto.altera_indicador ||
    impacto.altera_politica_comercial ||
    impacto.altera_funil ||
    impacto.altera_risco ||
    impacto.altera_perda ||
    /ipcp|indicador|política comercial|politica comercial|fórmula|formula|peso|pontuação|pontuacao|follow[- ]?up|valor estratégico|valor estrategico|conversão|conversao|perda|ganho|proposta enviada|recorrência|recorrencia|alto valor|qualidade do registro|maturidade comercial/.test(
      texto,
    ),
  )
}

export async function buscarDecisaoSuperiorExistenteCuradoriaNexo(evento: NexoCuradoriaEvento) {
  try {
    return await pb
      .collection(DECISOES_COLLECTION)
      .getFirstListItem<NexoCuradoriaDecisaoSuperior>(filtroDecisaoExistente(evento), {
        sort: '-created_at',
      })
  } catch (error: any) {
    if (error?.status === 404 || error?.status === 403) return null
    throw error
  }
}
