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
  audit_id?: string
  created_at?: string
  created?: string
  human_review_required?: boolean
  segundo_cerebro_usado?: boolean
  fallback?: boolean
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
}

const COLLECTION = 'com_nexo_aprendizado_eventos'
const ENTREVISTAS_COLLECTION = 'com_nexo_curadoria_entrevistas'
const DECISOES_COLLECTION = 'com_nexo_curadoria_decisoes'
const PENDING_FILTER = 'human_review_required = true'

function pbValor(valor?: string) {
  return String(valor || '').replace(/'/g, "\\'")
}

function filtroDecisaoExistente(evento: NexoCuradoriaEvento) {
  const filtros = [`evento_id = '${pbValor(evento.id)}'`]
  if (evento.external_id) filtros.push(`external_id = '${pbValor(evento.external_id)}'`)
  return `(${filtros.join(' || ')})`
}

function decisaoTerminal(decisao: NexoCuradoriaDecisaoSuperior | null) {
  return decisao?.status === 'aprovada_uso_operacional' || decisao?.status === 'rejeitada'
}

async function filtrarEventosComDecisaoTerminal(eventos: NexoCuradoriaEvento[]) {
  const pares = await Promise.all(
    eventos.map(async (evento) => ({
      evento,
      decisao: await buscarDecisaoSuperiorExistenteCuradoriaNexo(evento),
    })),
  )

  return pares.filter(({ decisao }) => !decisaoTerminal(decisao)).map(({ evento }) => evento)
}

export async function obterResumoCuradoriaNexo(limit = 5): Promise<NexoCuradoriaResumo> {
  const response = await pb.collection(COLLECTION).getList<NexoCuradoriaEvento>(1, Math.max(limit * 3, limit), {
    filter: PENDING_FILTER,
    sort: '-created_at',
  })
  const itensAbertos = (await filtrarEventosComDecisaoTerminal(response.items)).slice(0, limit)

  return {
    pendencias: itensAbertos.length,
    itens: itensAbertos,
  }
}

export async function obterDecisoesSuperioresCuradoriaNexo(limit = 10) {
  try {
    const response = await pb.collection(DECISOES_COLLECTION).getList<NexoCuradoriaDecisaoSuperior>(1, limit, {
      filter: "status = 'aguardando_revisao'",
      sort: '-created_at',
    })

    return response.items
  } catch (error: any) {
    if (error?.status === 403) return []
    throw error
  }
}

export async function buscarDecisaoSuperiorExistenteCuradoriaNexo(evento: NexoCuradoriaEvento) {
  try {
    return await pb.collection(DECISOES_COLLECTION).getFirstListItem<NexoCuradoriaDecisaoSuperior>(
      filtroDecisaoExistente(evento),
      { sort: '-created_at' },
    )
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
}: AtualizarDecisaoSuperiorCuradoriaInput) {
  const usuario = pb.authStore.model
  const payload: Record<string, string> = {
    updated_at: new Date().toISOString(),
    usuario_nome: usuario?.name || usuario?.email || '',
  }

  if (status) payload.status = status
  if (regra_proposta !== undefined) payload.regra_proposta = regra_proposta.trim()
  if (excecao_condicao !== undefined) payload.excecao_condicao = excecao_condicao.trim()
  if (responsavel_validacao !== undefined) payload.responsavel_validacao = responsavel_validacao.trim()
  if (decisao_observacao !== undefined) payload.decisao_observacao = decisao_observacao.trim()

  return pb.collection(DECISOES_COLLECTION).update<NexoCuradoriaDecisaoSuperior>(id, payload)
}
