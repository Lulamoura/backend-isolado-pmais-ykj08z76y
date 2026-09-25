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

export interface NexoCuradoriaResposta {
  pergunta: string
  resposta: string
}

export interface SalvarEntrevistaCuradoriaInput {
  evento: NexoCuradoriaEvento
  perguntas: string[]
  respostas: string[]
}

export interface ImpactoDecisaoCuradoria {
  altera_funil: boolean
  altera_risco: boolean
  altera_perda: boolean
  altera_indicador: boolean
  altera_politica_comercial: boolean
}

export interface SalvarDecisaoSuperiorCuradoriaInput {
  evento: NexoCuradoriaEvento
  entrevistaId?: string
  respostas: string[]
  impacto: ImpactoDecisaoCuradoria
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

export type StatusDecisaoSuperiorCuradoria =
  | 'aguardando_revisao'
  | 'aprovada_uso_operacional'
  | 'rejeitada'

export interface AtualizarDecisaoSuperiorCuradoriaInput {
  id: string
  status?: StatusDecisaoSuperiorCuradoria
  regra_proposta?: string
  excecao_condicao?: string
  responsavel_validacao?: string
  decisao_observacao?: string
  ipcp_revisao_status?: string
  ipcp_revisao_motivo?: string
}

const COLLECTION = 'com_nexo_aprendizado_eventos'
const ENTREVISTAS_COLLECTION = 'com_nexo_curadoria_entrevistas'
const DECISOES_COLLECTION = 'com_nexo_curadoria_decisoes'
const PENDING_FILTER =
  "(triagem_status = 'curadoria_necessaria' || triagem_status = '') && human_review_required = true"

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
  return 'Avaliação do negócio indicou necessidade de curadoria, mas o motivo específico ainda não foi detalhado.'
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
  const eventosAbertos = await filtrarEventosAguardandoCuradoria(response.items)
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

export async function salvarEntrevistaCuradoriaNexo({
  evento,
  perguntas,
  respostas,
}: SalvarEntrevistaCuradoriaInput) {
  const usuario = pb.authStore.model
  const respostasEstruturadas: NexoCuradoriaResposta[] = perguntas.map((pergunta, index) => ({
    pergunta,
    resposta: respostas[index]?.trim() || '',
  }))

  return pb.collection(ENTREVISTAS_COLLECTION).create({
    evento_id: evento.id,
    external_id: evento.external_id || '',
    empresa_nome: evento.empresa_nome || '',
    contato_nome: evento.contato_nome || '',
    negocio_titulo: evento.negocio_titulo || '',
    status: 'aguardando_revisao',
    perguntas_json: JSON.stringify(perguntas),
    respostas_json: JSON.stringify(respostasEstruturadas),
    resumo_contexto: evento.contexto_resumo || '',
    usuario_id: usuario?.id || '',
    usuario_nome: usuario?.name || usuario?.email || '',
    created_at: new Date().toISOString(),
  })
}

export function decisaoExigeDirecao(impacto: ImpactoDecisaoCuradoria) {
  return Boolean(
    impacto.altera_funil ||
    impacto.altera_risco ||
    impacto.altera_perda ||
    impacto.altera_indicador ||
    impacto.altera_politica_comercial,
  )
}

export async function salvarDecisaoSuperiorCuradoriaNexo({
  evento,
  entrevistaId,
  respostas,
  impacto,
}: SalvarDecisaoSuperiorCuradoriaInput) {
  const usuario = pb.authStore.model
  const escalarDirecao = decisaoExigeDirecao(impacto)
  const decisaoExistente = await buscarDecisaoSuperiorExistenteCuradoriaNexo(evento)
  if (decisaoExistente) throw new Error('DECISAO_SUPERIOR_DUPLICADA')

  return pb.collection(DECISOES_COLLECTION).create({
    evento_id: evento.id,
    entrevista_id: entrevistaId || '',
    external_id: evento.external_id || '',
    empresa_nome: evento.empresa_nome || '',
    contato_nome: evento.contato_nome || '',
    negocio_titulo: evento.negocio_titulo || '',
    status: 'aguardando_revisao',
    nivel_decisao: escalarDirecao ? 'direcao_comercial' : 'gestor_comercial',
    escalar_direcao: escalarDirecao,
    regra_proposta: respostas[0]?.trim() || '',
    excecao_condicao: respostas[1]?.trim() || '',
    responsavel_validacao: respostas[2]?.trim() || '',
    impacto_json: JSON.stringify(impacto),
    origem_respostas_json: JSON.stringify(respostas),
    usuario_id: usuario?.id || '',
    usuario_nome: usuario?.name || usuario?.email || '',
    created_at: new Date().toISOString(),
  })
}

export async function atualizarDecisaoSuperiorCuradoriaNexo({
  id,
  status,
  regra_proposta,
  excecao_condicao,
  responsavel_validacao,
  decisao_observacao,
  ipcp_revisao_status,
  ipcp_revisao_motivo,
}: AtualizarDecisaoSuperiorCuradoriaInput) {
  const usuario = pb.authStore.model
  const payload: Record<string, string> = {
    updated_at: new Date().toISOString(),
    usuario_nome: usuario?.name || usuario?.email || '',
  }

  if (status) payload.status = status
  if (regra_proposta !== undefined) payload.regra_proposta = regra_proposta.trim()
  if (excecao_condicao !== undefined) payload.excecao_condicao = excecao_condicao.trim()
  if (responsavel_validacao !== undefined)
    payload.responsavel_validacao = responsavel_validacao.trim()
  if (decisao_observacao !== undefined) payload.decisao_observacao = decisao_observacao.trim()
  if (ipcp_revisao_status !== undefined) payload.ipcp_revisao_status = ipcp_revisao_status.trim()
  if (ipcp_revisao_motivo !== undefined) payload.ipcp_revisao_motivo = ipcp_revisao_motivo.trim()

  return pb.collection(DECISOES_COLLECTION).update<NexoCuradoriaDecisaoSuperior>(id, payload)
}

export async function sincronizarDecisaoSegundoCerebroCuradoriaNexo(id: string) {
  return pb.send<NexoCuradoriaDecisaoSuperior>(
    `/backend/v1/nexo/curadoria/decisoes/${id}/segundo-cerebro`,
    {
      method: 'POST',
    },
  )
}

export async function atualizarRevisaoIpcpCuradoriaNexo(
  id: string,
  status: string,
  motivo: string,
) {
  return pb.send<NexoCuradoriaDecisaoSuperior>(
    `/backend/v1/nexo/curadoria/decisoes/${id}/ipcp-revisao`,
    {
      method: 'POST',
      body: {
        status,
        motivo,
      },
    },
  )
}
