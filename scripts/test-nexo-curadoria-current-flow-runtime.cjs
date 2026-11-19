const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const vm = require('vm')

const POLICY_KEY = 'nexo.curadoria.fluxo_corrente_v1'
const POLICY_VERSION = 'pmais_nexo_auto_promotion_policy_v1'
const AUTOMATIC_SCHEMA_VERSION = 'pmais_nexo_curadoria_conhecimento_automatico_v1'
const AUTOMATIC_AGENT_ID = 'nexo-curadoria-automatico'
const CUTOFF_CREATED = '2026-10-20 10:00:00.000Z'
const CUTOFF_ID = 'zzzzzzzzzzzzzzz'

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(',')}}`
}

class MockRecord {
  constructor(collection, id, values) {
    this.collection = typeof collection === 'string' ? { name: collection } : collection
    this.id = id || ''
    this.values = { ...(values || {}) }
  }
  getString(name) {
    const value = this.values[name]
    return value === undefined || value === null ? '' : String(value)
  }
  getBool(name) {
    return Boolean(this.values[name])
  }
  getInt(name) {
    return Number(this.values[name] || 0)
  }
  get(name) {
    return this.values[name]
  }
  set(name, value) {
    this.values[name] = value
  }
}

const profile = new MockRecord('com_perfis', 'profile-admin', {
  ativo: true,
  slug: 'superadministrador',
})
const actor = new MockRecord('users', 'user-admin', {
  ativo_comercial: true,
  perfil_id: profile.id,
})
const policy = {
  policy_version: POLICY_VERSION,
  cutoff: { created: CUTOFF_CREATED, id: CUTOFF_ID },
  automatic_schema_version: AUTOMATIC_SCHEMA_VERSION,
  automatic_agent_id: AUTOMATIC_AGENT_ID,
  integrity_hash: crypto
    .createHash('sha256')
    .update(
      `${POLICY_VERSION}|${CUTOFF_CREATED}|${CUTOFF_ID}|${AUTOMATIC_SCHEMA_VERSION}|${AUTOMATIC_AGENT_ID}`,
    )
    .digest('hex'),
}
const parameter = new MockRecord('com_parametros', 'parameter-current-flow', {
  chave: POLICY_KEY,
  valor: JSON.stringify(policy),
  ativo: true,
  tipo: 'json_imutavel',
  versao: 1,
})
const n4RuntimeGate = new MockRecord('com_parametros', 'parameter-n4-runtime', {
  chave: 'nexo.curadoria.homologacao_n4_runtime_v1',
  valor: JSON.stringify({
    gate_version: 'pmais_nexo_curadoria_homologacao_n4_runtime_v1',
    batch_id: '20261118-a1',
    execution_surface: 'shared_production_assisted',
    evidence_refs: [
      'n4-homologacao-20261118-a1:routine-1',
      'n4-homologacao-20261118-a1:routine-2',
      'n4-homologacao-20261118-a1:routine-3',
      'n4-homologacao-20261118-a1:conflict-1',
    ],
  }),
  ativo: true,
  tipo: 'json_imutavel',
  versao: 1,
})

function ledger(id, created, values) {
  return new MockRecord('com_ledger_comercial', id, {
    fonte: 'nexo_app',
    canal: 'Ajuda do Nexo',
    empresa_nome: 'Cliente corrente',
    negocio_id: `negocio-${id}`,
    negocio_ref: `OE-${id}`,
    responsavel: 'Equipe Comercial',
    responsavel_id: 'seller-1',
    equipe_id: 'equipe-comercial',
    tipo_evento: 'preferencia_comunicacao',
    fato: 'Cliente prefere receber resumo objetivo antes da reunião.',
    evidencia_ref: `event-${id}`,
    destino_sugerido: 'historico',
    risco: 'baixo',
    confianca: 'alta',
    promocao_modo: 'promover_baixo_risco',
    occurred_at: created,
    created,
    status: 'novo',
    ...values,
  })
}

function ledgerHash(record) {
  const fields = [
    'fonte',
    'evidencia_ref',
    'status',
    'occurred_at',
    'created',
    'fato',
    'observacao',
    'tipo_evento',
    'risco',
    'negocio_id',
    'negocio_ref',
    'empresa_nome',
    'contato_nome',
    'responsavel',
    'responsavel_id',
    'equipe_id',
    'destino_sugerido',
    'confianca',
    'promocao_modo',
    'revisao_status',
  ]
  const projection = { id: record.id }
  for (const field of fields) projection[field] = record.getString(field)
  return crypto.createHash('sha256').update(canonicalJson(projection)).digest('hex')
}

const rows = [
  ledger('historical', '2026-10-19 09:00:00.000Z'),
  ledger('ledger-before-cutoff-id', CUTOFF_CREATED),
  ledger('routine', '2026-10-20 11:00:00.000Z', {
    fonte: 'homologacao_n4',
    evidencia_ref: 'n4-homologacao-20261118-a1:routine-1',
  }),
  ledger('routine-2', '2026-10-20 11:10:00.000Z', {
    fonte: 'homologacao_n4',
    evidencia_ref: 'n4-homologacao-20261118-a1:routine-2',
  }),
  ledger('routine-3', '2026-10-20 11:20:00.000Z', {
    fonte: 'homologacao_n4',
    evidencia_ref: 'n4-homologacao-20261118-a1:routine-3',
  }),
  ledger('missing-proof', '2026-10-20 12:00:00.000Z', {
    evidencia_ref: '',
    confianca: 'media',
    destino_sugerido: 'curadoria',
    tipo_evento: 'objecao_comercial',
    fato: 'Objeção comercial sem prova suficiente precisa de validação.',
  }),
  ledger('sensitive000001', '2026-10-20 13:00:00.000Z', {
    fato: 'Cliente pediu desconto no preço e alteração de política comercial.',
  }),
  ledger('conflict', '2026-10-20 14:00:00.000Z', {
    tipo_evento: 'followup',
    fato: 'Novo follow-up contradiz a regra vigente.',
  }),
  ledger('noise0000000001', '2026-10-20 15:00:00.000Z', {
    fato: 'Obrigado.',
    tipo_evento: 'mensagem',
    promocao_modo: '',
    destino_sugerido: 'historico',
    confianca: 'media',
    negocio_id: '',
    negocio_ref: '',
    equipe_id: '',
  }),
]
const n6Selected = rows.find((item) => item.id === 'sensitive000001')
const n6Noise = rows.find((item) => item.id === 'noise0000000001')
const n6RuntimeGate = new MockRecord('com_parametros', 'parameter-n6-runtime', {
  chave: 'nexo.curadoria.lote_n6_runtime_v1',
  valor: JSON.stringify({
    gate_version: 'pmais_nexo_curadoria_lote_n6_runtime_v1',
    batch_id: '20261119-a1',
    execution_surface: 'shared_production_assisted',
    expected_classification: 'direction_exception',
    expected_group_count: 1,
    ledger_ids: [n6Selected.id],
    ledger_hashes: { [n6Selected.id]: ledgerHash(n6Selected) },
  }),
  ativo: true,
  tipo: 'json_imutavel',
  versao: 1,
})

const activeRule = new MockRecord('com_nexo_curadoria_casos', 'active-followup-rule', {
  fingerprint: 'legacy-active-followup-rule',
  recorrencia_chave: crypto
    .createHash('sha256')
    .update('curadoria-recorrencia-v2|equipe-comercial|followup')
    .digest('hex'),
  status: 'aprovado',
  conhecimento_status: 'ativo',
  created: '2026-10-19 08:00:00.000Z',
})

const historicalMatchingCase = new MockRecord(
  'com_nexo_curadoria_casos',
  'historical-matching-preference',
  {
    fingerprint: crypto
      .createHash('sha256')
      .update('curadoria-padrao-v2|equipe|equipe-comercial|preferencia_comunicacao')
      .digest('hex'),
    recorrencia_chave: crypto
      .createHash('sha256')
      .update('curadoria-recorrencia-v2|equipe-comercial|preferencia_comunicacao')
      .digest('hex'),
    revisao: 7,
    status: 'aprovado',
    conhecimento_status: 'ativo',
    evidencia_contagem: 4,
    recorrencia_contagem: 4,
    evidencia_hashes: ['historical-evidence'],
    fontes: ['historical-source'],
    resumo_factual: 'Estado histórico imutável.',
  },
)
const historicalMatchingSnapshot = JSON.stringify(historicalMatchingCase.values)

const collections = {
  users: [actor],
  com_perfis: [profile],
  com_parametros: [parameter, n4RuntimeGate, n6RuntimeGate],
  com_ledger_comercial: rows,
  com_nexo_curadoria_casos: [activeRule, historicalMatchingCase],
  com_nexo_curadoria_evidencias: [],
  com_nexo_curadoria_transicoes: [],
  com_nexo_curadoria_outbox: [],
}
let nextId = 1
let saves = 0
let beforeTransaction = null
function records(name) {
  if (!collections[name]) collections[name] = []
  return collections[name]
}
const app = {
  findRecordById(collection, id) {
    const found = records(collection).find((item) => item.id === id)
    if (!found) throw new Error('not found')
    return found
  },
  findFirstRecordByData(collection, field, value) {
    const found = records(collection).find((item) => item.getString(field) === value)
    if (!found) throw new Error('not found')
    return found
  },
  findRecordsByFilter(collection, _filter, _sort, limit, offset) {
    return records(collection).slice(
      offset || 0,
      (offset || 0) + (limit || records(collection).length),
    )
  },
  findCollectionByNameOrId(name) {
    return { name }
  },
  save(record) {
    saves++
    const target = records(record.collection.name)
    if (!record.id) {
      record.id = `generated-${nextId++}`
      if (record.collection.name === 'com_nexo_curadoria_casos' && !record.getString('created'))
        record.set('created', '2026-10-21 00:00:00.000Z')
      target.push(record)
    }
  },
  runInTransaction(callback) {
    if (beforeTransaction) beforeTransaction()
    return callback(this)
  },
}
function RecordCtor(collection) {
  return new MockRecord(collection, '', {})
}
const routes = {}
const automaticSecrets = {
  PMAIS_CURADORIA_PREVIEW_GATEWAY_URL: 'https://agents.example.test/preview/nexo',
  PMAIS_CURADORIA_API_KEY: 'human-key-unused',
  PMAIS_CURADORIA_HMAC_SECRET: 'human-secret-unused',
  PMAIS_CURADORIA_APPROVAL_SECRET: 'human-approval-unused',
  PMAIS_CURADORIA_AUTOMATIC_API_KEY: 'automatic-preview-key',
  PMAIS_CURADORIA_AUTOMATIC_HMAC_SECRET: 'automatic-preview-transport-secret',
  PMAIS_CURADORIA_AUTOMATIC_POLICY_SECRET: 'automatic-preview-policy-secret',
  PMAIS_CURADORIA_AUTOMATIC_AGENT_ID: AUTOMATIC_AGENT_ID,
}
const gatewayCalls = []
const context = {
  console,
  Date,
  JSON,
  Math,
  Record: RecordCtor,
  $app: app,
  $os: { getenv: (name) => automaticSecrets[name] || '' },
  $http: {
    send(request) {
      const outboundPayload = JSON.parse(request.body)
      gatewayCalls.push(request)
      return {
        statusCode: 200,
        json: {
          ok: true,
          readback_confirmed: true,
          payload_hash: request.headers['x-pmais-payload-hash'],
          knowledge_ref: outboundPayload.knowledge_ref,
          action: outboundPayload.action,
          case_revision: outboundPayload.case_revision,
          authorization_type: 'automatic_policy',
          policy_proof_id: outboundPayload.policy_proof.proof_id,
          policy_version: outboundPayload.policy_proof.policy_version,
          agent_id: outboundPayload.policy_proof.agent_id,
          audit_id: 'automatic-gateway-audit',
          version: String(outboundPayload.case_revision),
        },
        raw: '',
      }
    },
  },
  $security: {
    sha256: (value) => crypto.createHash('sha256').update(String(value)).digest('hex'),
    hs256: (value, secret) =>
      crypto.createHmac('sha256', secret).update(String(value)).digest('hex'),
  },
  $apis: { bodyLimit: () => () => {}, requireAuth: () => () => {} },
  routerAdd(method, path, callback) {
    routes[`${method} ${path}`] = callback
  },
}
vm.createContext(context)
const hookSource = fs.readFileSync('pocketbase/hooks/com_propostas_operacao.js', 'utf8')
vm.runInContext(hookSource, context)
const route = routes['POST /backend/v1/nexo/curadoria/casos/consolidar']
assert(route, 'current-flow consolidation route must exist')
function invoke(
  body,
  origin = 'https://backend-isolado-pmais-43b9c--preview.goskip.app',
  host = 'backend-isolado-pmais-43b9c.shrd03-1.internal.goskip.dev',
) {
  let response
  route({
    auth: actor,
    requestInfo: () => ({ body }),
    request: {
      header: {
        get: (name) => (name === 'Origin' ? origin : name === 'Host' ? host : ''),
      },
    },
    json(status, payload) {
      response = { status, payload }
      return response
    },
    forbiddenError(message) {
      response = { status: 403, payload: { message } }
      return response
    },
  })
  return response
}

const preview = invoke({ dry_run: true })
assert.equal(preview.status, 200)
assert.equal(preview.payload.policy_version, POLICY_VERSION)
assert.deepEqual(preview.payload.cutoff, policy.cutoff)
assert.equal(preview.payload.historical_untouched, 2)
assert.equal(preview.payload.automatic_cases, 1)
assert.equal(preview.payload.human_exceptions, 2)
assert.equal(preview.payload.noise_ignored, 2)
assert.deepEqual(preview.payload.classification_counts, {
  ledger_records: {
    discarded_noise: 2,
    operational_history: 0,
  },
  consolidated_groups: {
    hypothesis_waiting_evidence: 0,
    automatic_promotion: 1,
    management_exception: 0,
    direction_exception: 2,
  },
})
assert.deepEqual(preview.payload.guardrails, {
  no_mutation: true,
  no_send: true,
  no_publication: true,
})
assert.equal(saves, 0)

const n6ProductionAttempt = invoke(
  {
    dry_run: true,
    modo: 'lote_governado_n6',
    ledger_ids: [n6Selected.id],
  },
  'https://comercial.pmaisservicos.com.br',
)
assert.equal(n6ProductionAttempt.status, 403)

const n6DryRun = invoke({
  dry_run: true,
  modo: 'lote_governado_n6',
  ledger_ids: [n6Selected.id],
})
assert.equal(n6DryRun.status, 200)
assert.equal(n6DryRun.payload.execution_scope, 'lote_governado_n6')
assert.equal(n6DryRun.payload.selected_ledger_ids, 1)
assert.equal(n6DryRun.payload.human_exceptions, 1)
assert.equal(n6DryRun.payload.automatic_cases, 0)
assert.equal(saves, 0)

const n6DuplicateId = invoke({
  dry_run: true,
  modo: 'lote_governado_n6',
  ledger_ids: [n6Selected.id, n6Selected.id],
})
assert.equal(n6DuplicateId.status, 400)

collections.com_parametros.splice(collections.com_parametros.indexOf(n6RuntimeGate), 1)
const n6MissingGate = invoke({
  dry_run: true,
  modo: 'lote_governado_n6',
  ledger_ids: [n6Selected.id],
})
assert.equal(n6MissingGate.status, 503)
collections.com_parametros.push(n6RuntimeGate)

const n6OriginalFact = n6Selected.getString('fato')
n6Selected.set('fato', `${n6OriginalFact} alteração concorrente`)
const n6HashMismatch = invoke({
  dry_run: true,
  modo: 'lote_governado_n6',
  ledger_ids: [n6Selected.id],
})
assert.equal(n6HashMismatch.status, 409)
n6Selected.set('fato', n6OriginalFact)

const n6MissingConfirmation = invoke({
  dry_run: false,
  modo: 'lote_governado_n6',
  ledger_ids: [n6Selected.id],
  confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
})
assert.equal(n6MissingConfirmation.status, 400)

const n6ConcurrentCase = new MockRecord('com_nexo_curadoria_casos', 'n6concurrent001', {
  fingerprint: crypto
    .createHash('sha256')
    .update('curadoria-caso-v1|negocio|OE-sensitive000001|preco_ou_desconto')
    .digest('hex'),
  recorrencia_chave: crypto
    .createHash('sha256')
    .update('curadoria-recorrencia-v2|equipe-comercial|preco_ou_desconto')
    .digest('hex'),
  revisao: 1,
  status: 'aguardando_direcao',
  conhecimento_status: '',
  evidencia_hashes: [],
  evidencia_contagem: 0,
  recorrencia_contagem: 0,
  alcada: 'direcao',
  human_review_required: true,
  automatic_promotion_allowed: false,
  created: '2026-10-21 01:00:00.000Z',
})
let n6ConcurrentInserted = false
beforeTransaction = () => {
  if (n6ConcurrentInserted) return
  n6ConcurrentInserted = true
  collections.com_nexo_curadoria_casos.push(n6ConcurrentCase)
}
const n6ConcurrentProjection = invoke({
  dry_run: false,
  modo: 'lote_governado_n6',
  ledger_ids: [n6Selected.id],
  confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
  confirmacao_lote_n6: 'APLICAR_LOTE_GOVERNADO_N6',
})
assert.equal(n6ConcurrentProjection.status, 500)
assert.equal(collections.com_nexo_curadoria_evidencias.length, 0)
assert.equal(collections.com_nexo_curadoria_transicoes.length, 0)
collections.com_nexo_curadoria_casos.splice(
  collections.com_nexo_curadoria_casos.indexOf(n6ConcurrentCase),
  1,
)
beforeTransaction = null

const n6CaseCountBefore = collections.com_nexo_curadoria_casos.length
const n6EvidenceCountBefore = collections.com_nexo_curadoria_evidencias.length
const n6TransitionCountBefore = collections.com_nexo_curadoria_transicoes.length
const n6OutboxCountBefore = collections.com_nexo_curadoria_outbox.length
const n6Apply = invoke({
  dry_run: false,
  modo: 'lote_governado_n6',
  ledger_ids: [n6Selected.id],
  confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
  confirmacao_lote_n6: 'APLICAR_LOTE_GOVERNADO_N6',
})
assert.equal(n6Apply.status, 200)
assert.equal(n6Apply.payload.casos_criados, 1)
assert.equal(n6Apply.payload.evidencias_criadas, 1)
assert.equal(n6Apply.payload.publicacao_enfileirada, false)
assert.equal(collections.com_nexo_curadoria_outbox.length, n6OutboxCountBefore)
const n6Case = collections.com_nexo_curadoria_casos.at(-1)
assert.equal(n6Case.getString('status'), 'aguardando_direcao')
assert.equal(n6Case.getString('alcada'), 'direcao')
assert.equal(n6Case.getBool('automatic_promotion_allowed'), false)

const n6Replay = invoke({
  dry_run: false,
  modo: 'lote_governado_n6',
  ledger_ids: [n6Selected.id],
  confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
  confirmacao_lote_n6: 'APLICAR_LOTE_GOVERNADO_N6',
})
assert.equal(n6Replay.status, 200)
assert.equal(n6Replay.payload.casos_criados, 0)
assert.equal(n6Replay.payload.casos_atualizados, 0)
assert.equal(n6Replay.payload.evidencias_criadas, 0)
assert.equal(collections.com_nexo_curadoria_casos.length, n6CaseCountBefore + 1)
assert.equal(collections.com_nexo_curadoria_evidencias.length, n6EvidenceCountBefore + 1)
assert.equal(collections.com_nexo_curadoria_transicoes.length, n6TransitionCountBefore + 1)
const n6GateValueBeforeNoise = n6RuntimeGate.getString('valor')
n6RuntimeGate.set(
  'valor',
  JSON.stringify({
    gate_version: 'pmais_nexo_curadoria_lote_n6_runtime_v1',
    batch_id: '20261119-a1-noise',
    execution_surface: 'shared_production_assisted',
    expected_classification: 'direction_exception',
    expected_group_count: 1,
    ledger_ids: [n6Selected.id, n6Noise.id],
    ledger_hashes: {
      [n6Selected.id]: ledgerHash(n6Selected),
      [n6Noise.id]: ledgerHash(n6Noise),
    },
  }),
)
const n6ReplayWithUnrepresentedNoise = invoke({
  dry_run: true,
  modo: 'lote_governado_n6',
  ledger_ids: [n6Selected.id, n6Noise.id],
})
assert.equal(n6ReplayWithUnrepresentedNoise.status, 409)
n6RuntimeGate.set('valor', n6GateValueBeforeNoise)
collections.com_nexo_curadoria_casos.splice(n6CaseCountBefore)
collections.com_nexo_curadoria_evidencias.splice(n6EvidenceCountBefore)
collections.com_nexo_curadoria_transicoes.splice(n6TransitionCountBefore)

const isolatedRefs = [
  'n4-homologacao-20261118-a1:routine-1',
  'n4-homologacao-20261118-a1:routine-2',
  'n4-homologacao-20261118-a1:routine-3',
]
const isolatedProductionAttempt = invoke(
  {
    dry_run: false,
    modo: 'homologacao_isolada_n4',
    evidencia_refs: isolatedRefs,
    confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
    confirmacao_homologacao: 'APLICAR_HOMOLOGACAO_ISOLADA_N4',
  },
  'https://comercial.pmaisservicos.com.br',
  'backend-isolado-pmais-43b9c.goskip.app',
)
assert.equal(isolatedProductionAttempt.status, 403)
assert.equal(collections.com_nexo_curadoria_casos.length, 2)

const omittedHostPreviewAttempt = invoke(
  {
    dry_run: true,
    modo: 'homologacao_isolada_n4',
    evidencia_refs: isolatedRefs,
  },
  'https://backend-isolado-pmais-43b9c--preview.goskip.app',
  '',
)
assert.equal(omittedHostPreviewAttempt.status, 200)
assert.equal(omittedHostPreviewAttempt.payload.execution_scope, 'homologacao_isolada_n4')
assert.equal(omittedHostPreviewAttempt.payload.selected_evidence_refs, 3)

collections.com_parametros.splice(collections.com_parametros.indexOf(n4RuntimeGate), 1)
const missingRuntimeGateAttempt = invoke({
  dry_run: true,
  modo: 'homologacao_isolada_n4',
  evidencia_refs: isolatedRefs,
})
assert.equal(missingRuntimeGateAttempt.status, 503)
collections.com_parametros.push(n4RuntimeGate)

const missingConfirmationAttempt = invoke({
  dry_run: false,
  modo: 'homologacao_isolada_n4',
  evidencia_refs: isolatedRefs,
  confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
})
assert.equal(missingConfirmationAttempt.status, 400)

const missingEvidenceAttempt = invoke({
  dry_run: true,
  modo: 'homologacao_isolada_n4',
  evidencia_refs: ['n4-homologacao-20261118-a1:conflict-1'],
})
assert.equal(missingEvidenceAttempt.status, 409)

const duplicateRefAttempt = invoke({
  dry_run: true,
  modo: 'homologacao_isolada_n4',
  evidencia_refs: [isolatedRefs[0], isolatedRefs[0]],
})
assert.equal(duplicateRefAttempt.status, 400)

const arbitraryRefAttempt = invoke({
  dry_run: true,
  modo: 'homologacao_isolada_n4',
  evidencia_refs: ['n4-homologacao-20261118-a1:arbitrary'],
})
assert.equal(arbitraryRefAttempt.status, 400)

const routineOne = collections.com_ledger_comercial.find(
  (item) => item.getString('evidencia_ref') === isolatedRefs[0],
)
routineOne.set('fonte', 'nexo_app')
const wrongSourceAttempt = invoke({
  dry_run: true,
  modo: 'homologacao_isolada_n4',
  evidencia_refs: isolatedRefs,
})
assert.equal(wrongSourceAttempt.status, 409)
routineOne.set('fonte', 'homologacao_n4')

const duplicateEvidence = new MockRecord('com_ledger_comercial', 'duplicate-n4-evidence', {
  ...routineOne.values,
})
collections.com_ledger_comercial.push(duplicateEvidence)
const ambiguousEvidenceAttempt = invoke({
  dry_run: true,
  modo: 'homologacao_isolada_n4',
  evidencia_refs: isolatedRefs,
})
assert.equal(ambiguousEvidenceAttempt.status, 409)
collections.com_ledger_comercial.splice(
  collections.com_ledger_comercial.indexOf(duplicateEvidence),
  1,
)

const isolatedPreview = invoke({
  dry_run: true,
  modo: 'homologacao_isolada_n4',
  evidencia_refs: isolatedRefs,
})
assert.equal(isolatedPreview.status, 200)
assert.equal(isolatedPreview.payload.execution_scope, 'homologacao_isolada_n4')
assert.equal(isolatedPreview.payload.selected_evidence_refs, 3)
assert.equal(isolatedPreview.payload.automatic_cases, 1)
assert.equal(isolatedPreview.payload.human_exceptions, 0)

const standardCollision = new MockRecord('com_nexo_curadoria_casos', 'standard-collision', {
  fingerprint: crypto
    .createHash('sha256')
    .update('curadoria-padrao-v2|equipe|team-1|rotina_comercial')
    .digest('hex'),
  revisao: 1,
  status: 'aberto_curadoria',
  fonte_principal: 'nexo_app',
  created: '2026-10-20 12:00:00.000Z',
})
collections.com_nexo_curadoria_casos.push(standardCollision)

let consolidationSourceChanged = false
beforeTransaction = () => {
  if (consolidationSourceChanged) return
  consolidationSourceChanged = true
  routineOne.set('fonte', 'nexo_app')
}
const changedScopeDuringConsolidation = invoke({
  dry_run: false,
  modo: 'homologacao_isolada_n4',
  evidencia_refs: isolatedRefs,
  confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
  confirmacao_homologacao: 'APLICAR_HOMOLOGACAO_ISOLADA_N4',
})
assert.equal(changedScopeDuringConsolidation.status, 500)
assert.equal(collections.com_nexo_curadoria_casos.length, 3)
assert.equal(collections.com_nexo_curadoria_outbox.length, 0)
routineOne.set('fonte', 'homologacao_n4')
beforeTransaction = null

const isolatedApplied = invoke({
  dry_run: false,
  modo: 'homologacao_isolada_n4',
  evidencia_refs: isolatedRefs,
  confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
  confirmacao_homologacao: 'APLICAR_HOMOLOGACAO_ISOLADA_N4',
})
assert.equal(isolatedApplied.status, 200)
assert.equal(isolatedApplied.payload.execution_scope, 'homologacao_isolada_n4')
assert.equal(isolatedApplied.payload.casos_criados, 1)
assert.equal(isolatedApplied.payload.human_exceptions, 0)
assert.equal(collections.com_nexo_curadoria_casos.length, 4)
assert.equal(collections.com_nexo_curadoria_outbox.length, 1)
assert.equal(standardCollision.getInt('revisao'), 1)
assert.equal(standardCollision.getString('fonte_principal'), 'nexo_app')
collections.com_nexo_curadoria_casos.splice(
  collections.com_nexo_curadoria_casos.indexOf(standardCollision),
  1,
)

const applied = invoke({ dry_run: false, confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL' })
assert.equal(applied.status, 200)
assert.equal(applied.payload.automatic_cases, 1)
assert.equal(applied.payload.human_exceptions, 2)
assert.equal(applied.payload.promocao_automatica_realizada, false)
assert.equal(applied.payload.publicacao_enfileirada, true)
assert.equal(applied.payload.noise_ignored, 2)
assert.equal(applied.payload.historical_untouched, 2)
assert.equal(collections.com_nexo_curadoria_casos.length, 6)
assert.equal(collections.com_nexo_curadoria_outbox.length, 2)
const applyReplayBeforePublication = invoke({
  dry_run: false,
  confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
})
assert.equal(applyReplayBeforePublication.status, 200)
assert.equal(applyReplayBeforePublication.payload.publicacao_enfileirada, false)
assert.equal(collections.com_nexo_curadoria_outbox.length, 2)

const automaticCase = collections.com_nexo_curadoria_casos.find(
  (item) =>
    item.getBool('automatic_promotion_allowed') &&
    item.getString('fonte_principal') === 'homologacao_n4',
)
assert(automaticCase)
assert.equal(automaticCase.getString('status'), 'aprovado')
assert.equal(automaticCase.getString('conhecimento_status'), 'pendente_publicacao')
assert.equal(automaticCase.getBool('human_review_required'), false)
assert.equal(automaticCase.getString('validado_por'), AUTOMATIC_AGENT_ID)
assert.equal(automaticCase.getString('created_by'), AUTOMATIC_AGENT_ID)
assert.equal(automaticCase.getString('updated_by'), AUTOMATIC_AGENT_ID)

const listRoute = routes['POST /backend/v1/nexo/curadoria/casos/listar']
assert(listRoute, 'curation list route must exist')
function invokeList() {
  let listResponse
  listRoute({
    auth: actor,
    requestInfo: () => ({ body: { limite: 100 } }),
    json(status, responsePayload) {
      listResponse = { status, payload: responsePayload }
      return listResponse
    },
    forbiddenError(message) {
      listResponse = { status: 403, payload: { message } }
      return listResponse
    },
  })
  return listResponse
}
const pendingPublicationView = invokeList()
assert.equal(pendingPublicationView.status, 200)
assert.equal(
  pendingPublicationView.payload.visoes.conhecimento_aprovado.some(
    (item) => item.conhecimento_status === 'pendente_publicacao',
  ),
  false,
  'pending publication must not be exposed as active approved knowledge',
)
assert.equal(
  pendingPublicationView.payload.visoes.publicacao_pendente.some(
    (item) => item.id === automaticCase.id && item.conhecimento_status === 'pendente_publicacao',
  ),
  true,
  'pending publication must remain visible in its own traceability view',
)

const automaticTransition = collections.com_nexo_curadoria_transicoes.find(
  (item) => item.getString('caso_id') === automaticCase.id,
)
assert(automaticTransition)
assert.equal(automaticTransition.getString('ator_id'), AUTOMATIC_AGENT_ID)
assert.equal(automaticTransition.get('metadados').decision_mode, 'agent_policy')
assert.equal(automaticTransition.get('metadados').agent_id, AUTOMATIC_AGENT_ID)
assert.equal(automaticTransition.get('metadados').policy_version, POLICY_VERSION)

const outbox = collections.com_nexo_curadoria_outbox[0]
assert.equal(outbox.getString('status'), 'pendente')
assert.equal(outbox.getString('acao'), 'publicar_automatico')
const payload = outbox.get('payload_json')
assert.deepEqual(Object.keys(payload).sort(), [
  'action',
  'case_revision',
  'confidence',
  'exception',
  'independent_businesses',
  'independent_cases',
  'independent_conversations',
  'knowledge_ref',
  'policy_proof',
  'rationale',
  'regra',
  'risk',
  'schema_version',
  'scope_type',
  'sources',
  'subject',
  'title',
])
assert.equal(payload.schema_version, AUTOMATIC_SCHEMA_VERSION)
assert.equal(payload.policy_proof.policy_version, POLICY_VERSION)
assert.equal(payload.policy_proof.agent_id, AUTOMATIC_AGENT_ID)
assert.deepEqual(
  {
    traceable: payload.policy_proof.traceable,
    non_sensitive: payload.policy_proof.no_sensitive_data,
    coherent: payload.policy_proof.coherent,
    reversible: payload.policy_proof.reversible,
    no_active_rule_conflict: payload.policy_proof.no_conflicts,
  },
  {
    traceable: true,
    non_sensitive: true,
    coherent: true,
    reversible: true,
    no_active_rule_conflict: true,
  },
)
assert.match(
  hookSource,
  /reversible:\s*texto\(ledger, 'promocao_modo'\) === 'promover_baixo_risco'/,
  'reversibility must be derived from the governed promotion mode',
)
assert.match(
  hookSource,
  /reversible:\s*!!grupo\.safety_predicates\.reversible/,
  'automatic policy proof must preserve the classified reversibility predicate',
)
const contentWithoutProof = { ...payload }
delete contentWithoutProof.policy_proof
assert.equal(
  payload.policy_proof.content_sha256,
  crypto.createHash('sha256').update(canonicalJson(contentWithoutProof)).digest('hex'),
)
assert.equal(
  outbox.getString('payload_hash'),
  crypto.createHash('sha256').update(canonicalJson(payload)).digest('hex'),
)
assert.match(
  hookSource,
  /isAutomaticPayload[\s\S]*\/v1\/comercial\/nexo\/curadoria\/conhecimento\/automatico[\s\S]*\/v1\/comercial\/nexo\/curadoria\/conhecimento/,
  'automatic decisions must use the separate Gateway endpoint while human publication stays intact',
)
assert.match(
  hookSource,
  /responseJson\.authorization_type === 'automatic_policy'[\s\S]*responseJson\.policy_proof_id === payload\.policy_proof\.proof_id[\s\S]*responseJson\.policy_version === payload\.policy_proof\.policy_version[\s\S]*responseJson\.agent_id === payload\.policy_proof\.agent_id/,
  'automatic outbox must fail closed unless Gateway readback confirms the governed decision',
)
assert.match(
  hookSource,
  /gatewayHeaders\['x-pmais-agent-id'\]\s*=\s*payload\.policy_proof\.agent_id[\s\S]*gatewayHeaders\['x-pmais-policy-signature'\]\s*=\s*\$security\.hs256\([\s\S]*nexoCuradoriaJsonCanonico\(payload\.policy_proof\),[\s\S]*automaticPolicySecret/,
  'automatic wire auth must identify the dedicated agent and sign the canonical policy proof',
)
assert.match(
  hookSource,
  /PMAIS_CURADORIA_AUTOMATIC_API_KEY[\s\S]*PMAIS_CURADORIA_AUTOMATIC_HMAC_SECRET[\s\S]*PMAIS_CURADORIA_AUTOMATIC_POLICY_SECRET[\s\S]*PMAIS_CURADORIA_AUTOMATIC_AGENT_ID[\s\S]*PMAIS_CURADORIA_PROD_AUTOMATIC_API_KEY[\s\S]*PMAIS_CURADORIA_PROD_AUTOMATIC_HMAC_SECRET[\s\S]*PMAIS_CURADORIA_PROD_AUTOMATIC_POLICY_SECRET[\s\S]*PMAIS_CURADORIA_PROD_AUTOMATIC_AGENT_ID/,
  'Preview and Production must use dedicated automatic credentials and identities',
)

const humanCases = collections.com_nexo_curadoria_casos.filter((item) =>
  item.getBool('human_review_required'),
)
assert.equal(humanCases.length, 2)
assert(humanCases.every((item) => !item.getBool('automatic_promotion_allowed')))
const conflictCase = humanCases.find((item) => item.getString('assunto_chave') === 'followup')
assert(conflictCase, 'active-rule conflict must become a human exception')
assert.match(conflictCase.getString('motivo_curadoria'), /conflito com orientação ativa/i)
assert.equal(
  collections.com_nexo_curadoria_casos.some(
    (item) => item.getString('escopo_ref') === 'OE-historical',
  ),
  false,
)
assert.equal(
  collections.com_nexo_curadoria_casos.some((item) => item.getString('escopo_ref') === 'OE-noise'),
  false,
)
assert.equal(
  JSON.stringify(historicalMatchingCase.values),
  historicalMatchingSnapshot,
  'post-cutoff evidence must never mutate or reopen a pre-cutoff case',
)
assert.equal(
  collections.com_nexo_curadoria_evidencias.some(
    (item) => item.getString('caso_id') === historicalMatchingCase.id,
  ),
  false,
  'post-cutoff evidence must not be attached to a pre-cutoff case',
)

const processRoute = routes['POST /backend/v1/nexo/curadoria/outbox/processar']
assert(processRoute, 'automatic outbox processor route must exist')
function invokeProcessor(
  body = { limite: 10 },
  origin = 'https://backend-isolado-pmais-43b9c--preview.goskip.app',
  host = 'backend-isolado-pmais-43b9c.shrd03-1.internal.goskip.dev',
) {
  let processResponse
  processRoute({
    auth: actor,
    requestInfo: () => ({ body }),
    request: {
      header: {
        get: (name) => (name === 'Origin' ? origin : name === 'Host' ? host : ''),
      },
    },
    json(status, responsePayload) {
      processResponse = { status, payload: responsePayload }
      return processResponse
    },
    forbiddenError(message) {
      processResponse = { status: 403, payload: { message } }
      return processResponse
    },
  })
  return processResponse
}
function resetOutboxForRetry() {
  outbox.set('status', 'pendente')
  outbox.set('next_attempt_at', null)
  outbox.set('claim_token', '')
  outbox.set('claim_expires_at', null)
  outbox.set('last_error', '')
}
const scopedProcessorBody = {
  limite: 10,
  modo: 'homologacao_isolada_n4',
  outbox_ids: [outbox.id],
  confirmacao_homologacao: 'PROCESSAR_OUTBOX_HOMOLOGACAO_ISOLADA_N4',
}

automaticTransition.set('ator_id', 'nexo')
let rejected = invokeProcessor(scopedProcessorBody)
assert.equal(rejected.status, 200)
assert.equal(rejected.payload.falhas, 1)
assert.equal(gatewayCalls.length, 0, 'mismatched transition actor must fail before Gateway')
automaticTransition.set('ator_id', AUTOMATIC_AGENT_ID)
resetOutboxForRetry()

const originalTitle = payload.title
payload.title = 'Conteúdo adulterado após a decisão'
const tamperedContent = { ...payload }
delete tamperedContent.policy_proof
payload.policy_proof.content_sha256 = crypto
  .createHash('sha256')
  .update(canonicalJson(tamperedContent))
  .digest('hex')
outbox.set('payload_hash', crypto.createHash('sha256').update(canonicalJson(payload)).digest('hex'))
rejected = invokeProcessor(scopedProcessorBody)
assert.equal(rejected.status, 200)
assert.equal(rejected.payload.falhas, 1)
assert.equal(
  gatewayCalls.length,
  0,
  'automatic payload must be reconstructed from authoritative state',
)
payload.title = originalTitle
payload.policy_proof.content_sha256 = crypto
  .createHash('sha256')
  .update(canonicalJson(contentWithoutProof))
  .digest('hex')
outbox.set('payload_hash', crypto.createHash('sha256').update(canonicalJson(payload)).digest('hex'))
resetOutboxForRetry()

automaticSecrets.PMAIS_CURADORIA_AUTOMATIC_AGENT_ID = 'nexo'
rejected = invokeProcessor(scopedProcessorBody)
assert.equal(rejected.status, 200)
assert.equal(rejected.payload.falhas, 1)
assert.equal(gatewayCalls.length, 0, 'arbitrary configured automatic identity must fail closed')
automaticSecrets.PMAIS_CURADORIA_AUTOMATIC_AGENT_ID = AUTOMATIC_AGENT_ID
resetOutboxForRetry()

const unrelatedOutbox = new MockRecord('com_nexo_curadoria_outbox', 'unrelated-pending', {
  caso_id: 'missing-unrelated-case',
  decisao_id: 'missing-unrelated-transition',
  acao: 'publicar_automatico',
  status: 'pendente',
  requested_at: '2026-10-20 16:00:00.000Z',
})
collections.com_nexo_curadoria_outbox.push(unrelatedOutbox)
const productionProcessorAttempt = invokeProcessor(
  scopedProcessorBody,
  'https://comercial.pmaisservicos.com.br',
  'backend-isolado-pmais-43b9c.goskip.app',
)
assert.equal(productionProcessorAttempt.status, 403)
assert.equal(outbox.getString('status'), 'pendente')

const omittedHostWithoutConfirmation = invokeProcessor(
  { ...scopedProcessorBody, confirmacao_homologacao: '' },
  'https://backend-isolado-pmais-43b9c--preview.goskip.app',
  '',
)
assert.equal(omittedHostWithoutConfirmation.status, 400)
assert.equal(outbox.getString('status'), 'pendente')

collections.com_parametros.splice(collections.com_parametros.indexOf(n4RuntimeGate), 1)
const missingProcessorRuntimeGate = invokeProcessor(scopedProcessorBody)
assert.equal(missingProcessorRuntimeGate.status, 503)
assert.equal(outbox.getString('status'), 'pendente')
collections.com_parametros.push(n4RuntimeGate)

const priorOutbox = new MockRecord('com_nexo_curadoria_outbox', 'prior-n4-operation', {
  caso_id: automaticCase.id,
  decisao_id: automaticTransition.id,
  acao: 'publicar_automatico',
  caso_revisao: outbox.getInt('caso_revisao'),
  status: 'pendente',
  requested_at: '2026-10-20 10:00:00.000Z',
})
collections.com_nexo_curadoria_outbox.push(priorOutbox)
const blockedByPrior = invokeProcessor(scopedProcessorBody)
assert.equal(blockedByPrior.status, 200)
assert.equal(blockedByPrior.payload.processados, 0)
assert.equal(blockedByPrior.payload.bloqueados_ordem, 1)
assert.equal(outbox.getString('status'), 'pendente')
assert.equal(gatewayCalls.length, 0)
priorOutbox.set('status', 'supersedido')

let gateRemovedDuringClaim = false
beforeTransaction = () => {
  if (gateRemovedDuringClaim) return
  gateRemovedDuringClaim = true
  collections.com_parametros.splice(collections.com_parametros.indexOf(n4RuntimeGate), 1)
}
const removedGateDuringClaim = invokeProcessor(scopedProcessorBody)
assert.equal(removedGateDuringClaim.status, 200)
assert.equal(removedGateDuringClaim.payload.processados, 0)
assert.equal(removedGateDuringClaim.payload.ignorados, 1)
assert.equal(outbox.getString('status'), 'pendente')
assert.equal(gatewayCalls.length, 0)
collections.com_parametros.push(n4RuntimeGate)
beforeTransaction = null

let preHttpTransactionCount = 0
beforeTransaction = () => {
  preHttpTransactionCount++
  if (preHttpTransactionCount !== 2) return
  collections.com_parametros.splice(collections.com_parametros.indexOf(n4RuntimeGate), 1)
}
const removedGateBeforeHttp = invokeProcessor(scopedProcessorBody)
assert.equal(removedGateBeforeHttp.status, 200)
assert.equal(removedGateBeforeHttp.payload.processados, 0)
assert.equal(removedGateBeforeHttp.payload.invalidados, 1)
assert.equal(outbox.getString('status'), 'invalidado')
assert.equal(gatewayCalls.length, 0)
collections.com_parametros.push(n4RuntimeGate)
beforeTransaction = null
resetOutboxForRetry()

let sourceChangedDuringClaim = false
beforeTransaction = () => {
  if (sourceChangedDuringClaim) return
  sourceChangedDuringClaim = true
  automaticCase.set('fonte_principal', 'nexo_app')
}
const changedScopeDuringClaim = invokeProcessor(scopedProcessorBody)
assert.equal(changedScopeDuringClaim.status, 200)
assert.equal(changedScopeDuringClaim.payload.processados, 0)
assert.equal(changedScopeDuringClaim.payload.ignorados, 1)
assert.equal(outbox.getString('status'), 'pendente')
assert.equal(gatewayCalls.length, 0)
automaticCase.set('fonte_principal', 'homologacao_n4')
beforeTransaction = null

const processResponse = invokeProcessor(scopedProcessorBody)
assert.equal(processResponse.status, 200)
assert.equal(processResponse.payload.processados, 1)
assert.equal(processResponse.payload.execution_scope, 'homologacao_isolada_n4')
assert.equal(unrelatedOutbox.getString('status'), 'pendente')
assert.equal(gatewayCalls.length, 1)
const gatewayCall = gatewayCalls[0]
assert.equal(
  gatewayCall.url,
  'https://agents.example.test/preview/nexo/v1/comercial/nexo/curadoria/conhecimento/automatico',
)
assert.equal(gatewayCall.headers['x-pmais-api-key'], 'automatic-preview-key')
assert.equal(gatewayCall.headers['x-pmais-agent-id'], AUTOMATIC_AGENT_ID)
assert.equal(
  gatewayCall.headers['x-pmais-signature'],
  crypto
    .createHmac('sha256', 'automatic-preview-transport-secret')
    .update(`${gatewayCall.headers['x-pmais-timestamp']}.${gatewayCall.body}`)
    .digest('hex'),
)
assert.equal(
  gatewayCall.headers['x-pmais-policy-signature'],
  crypto
    .createHmac('sha256', 'automatic-preview-policy-secret')
    .update(canonicalJson(payload.policy_proof))
    .digest('hex'),
)
assert.equal(outbox.getString('status'), 'processado')
assert.equal(automaticCase.getString('conhecimento_status'), 'ativo')
const activeKnowledgeView = invokeList()
assert.equal(activeKnowledgeView.status, 200)
assert.equal(
  activeKnowledgeView.payload.visoes.conhecimento_aprovado.some(
    (item) => item.conhecimento_status === 'ativo',
  ),
  true,
  'knowledge becomes active only after authoritative outbox readback',
)

const replay = invoke({ dry_run: false, confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL' })
assert.equal(replay.status, 200)
assert.equal(replay.payload.casos_criados, 0)
assert.equal(replay.payload.evidencias_criadas, 0)
assert.equal(replay.payload.publicacao_enfileirada, false)
assert.equal(collections.com_nexo_curadoria_outbox.length, 4)

parameter.set(
  'valor',
  JSON.stringify({ ...policy, cutoff: { created: CUTOFF_CREATED, id: 'changed' } }),
)
const changedPolicy = invoke({ dry_run: true })
assert.equal(changedPolicy.status, 503)
assert.equal(changedPolicy.payload.error, 'POLITICA_FLUXO_CORRENTE_INVALIDA')

const malformedCutoffDate = '2026-10-20T10:00:00.000Z'
parameter.set(
  'valor',
  JSON.stringify({
    ...policy,
    cutoff: { created: malformedCutoffDate, id: CUTOFF_ID },
    integrity_hash: crypto
      .createHash('sha256')
      .update(
        `${POLICY_VERSION}|${malformedCutoffDate}|${CUTOFF_ID}|${AUTOMATIC_SCHEMA_VERSION}|${AUTOMATIC_AGENT_ID}`,
      )
      .digest('hex'),
  }),
)
const malformedDatePolicy = invoke({ dry_run: true })
assert.equal(malformedDatePolicy.status, 503)
assert.equal(malformedDatePolicy.payload.error, 'POLITICA_FLUXO_CORRENTE_INVALIDA')

const impossibleCutoffDate = '2026-02-30 12:00:00.000Z'
parameter.set(
  'valor',
  JSON.stringify({
    ...policy,
    cutoff: { created: impossibleCutoffDate, id: CUTOFF_ID },
    integrity_hash: crypto
      .createHash('sha256')
      .update(
        `${POLICY_VERSION}|${impossibleCutoffDate}|${CUTOFF_ID}|${AUTOMATIC_SCHEMA_VERSION}|${AUTOMATIC_AGENT_ID}`,
      )
      .digest('hex'),
  }),
)
const impossibleDatePolicy = invoke({ dry_run: true })
assert.equal(impossibleDatePolicy.status, 503)
assert.equal(impossibleDatePolicy.payload.error, 'POLITICA_FLUXO_CORRENTE_INVALIDA')

const malformedCutoffId = 'invalid-id'
parameter.set(
  'valor',
  JSON.stringify({
    ...policy,
    cutoff: { created: CUTOFF_CREATED, id: malformedCutoffId },
    integrity_hash: crypto
      .createHash('sha256')
      .update(
        `${POLICY_VERSION}|${CUTOFF_CREATED}|${malformedCutoffId}|${AUTOMATIC_SCHEMA_VERSION}|${AUTOMATIC_AGENT_ID}`,
      )
      .digest('hex'),
  }),
)
const malformedIdPolicy = invoke({ dry_run: true })
assert.equal(malformedIdPolicy.status, 503)
assert.equal(malformedIdPolicy.payload.error, 'POLITICA_FLUXO_CORRENTE_INVALIDA')

parameter.set('valor', JSON.stringify({ ...policy, automatic_agent_id: 'nexo' }))
const changedAgentIdentity = invoke({ dry_run: true })
assert.equal(changedAgentIdentity.status, 503)
assert.equal(changedAgentIdentity.payload.error, 'POLITICA_FLUXO_CORRENTE_INVALIDA')

let migrateUp
const migrationRecords = []
let migrationLedgerCreatedField = null
let migrationCasesCreatedField = null
let migrationLedgerRows = [
  new MockRecord('com_ledger_comercial', 'old000000000001', { created: '' }),
]
const migrationLedgerCollection = {
  name: 'com_ledger_comercial',
  fields: {
    getByName: (name) => (name === 'created' ? migrationLedgerCreatedField : null),
    add: (field) => {
      if (field.name === 'created') migrationLedgerCreatedField = field
    },
  },
}
const migrationCasesCollection = {
  name: 'com_nexo_curadoria_casos',
  fields: {
    getByName: (name) => (name === 'created' ? migrationCasesCreatedField : null),
    add: (field) => {
      if (field.name === 'created') migrationCasesCreatedField = field
    },
  },
}
const migrationSandbox = {
  Record: RecordCtor,
  AutodateField: function AutodateField(options) {
    return { ...options, type: () => 'autodate' }
  },
  $security: context.$security,
  migrate(up) {
    migrateUp = up
  },
}
vm.createContext(migrationSandbox)
vm.runInContext(
  fs.readFileSync('pocketbase/migrations/202610291300_nexo_curadoria_fluxo_corrente.js', 'utf8'),
  migrationSandbox,
)
const migrationApp = {
  findFirstRecordByData(_collection, field, value) {
    const found = migrationRecords.find((record) => record.getString(field) === value)
    if (!found) throw new Error('not found')
    return found
  },
  findRecordsByFilter(collection, filter) {
    if (collection === 'com_parametros')
      return migrationRecords.filter((record) => record.getString('chave') === POLICY_KEY)
    if (collection === 'com_ledger_comercial' && filter === "created != ''")
      return migrationLedgerRows.filter((record) => record.getString('created'))
    if (collection === 'com_ledger_comercial' && filter === "id != ''") return migrationLedgerRows
    return []
  },
  findCollectionByNameOrId(name) {
    if (name === 'com_ledger_comercial') return migrationLedgerCollection
    if (name === 'com_nexo_curadoria_casos') return migrationCasesCollection
    return { name }
  },
  save(record) {
    if (record === migrationLedgerCollection || record === migrationCasesCollection) return
    record.id = record.id || 'policy-record'
    migrationRecords.push(record)
  },
}
assert.equal(typeof migrateUp, 'function')
migrateUp(migrationApp)
assert(migrationCasesCreatedField, 'migration must add immutable created to cases')
assert.equal(migrationRecords.length, 1)
const migratedPolicy = JSON.parse(migrationRecords[0].getString('valor'))
assert.match(
  migratedPolicy.cutoff.created,
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}Z$/,
  'migration must use the PocketBase lexical datetime format',
)
assert.equal(migratedPolicy.cutoff.id, '000000000000000')
assert.equal(migratedPolicy.automatic_agent_id, AUTOMATIC_AGENT_ID)
assert.equal(
  migratedPolicy.integrity_hash,
  crypto
    .createHash('sha256')
    .update(
      `${POLICY_VERSION}|${migratedPolicy.cutoff.created}|${migratedPolicy.cutoff.id}|${AUTOMATIC_SCHEMA_VERSION}|${AUTOMATIC_AGENT_ID}`,
    )
    .digest('hex'),
)
assert.doesNotThrow(() => migrateUp(migrationApp), 'exact identity-bound policy must be idempotent')
migrationRecords[0].set('valor', JSON.stringify({ ...migratedPolicy, automatic_agent_id: 'nexo' }))
assert.throws(
  () => migrateUp(migrationApp),
  /incompatible immutable current-flow policy/,
  'migration must reject an existing policy bound to another automatic identity',
)

migrationRecords[0].set(
  'valor',
  JSON.stringify({
    ...migratedPolicy,
    cutoff: { created: '2026-10-29T16:00:00.000Z', id: '000000000000000' },
    integrity_hash: crypto
      .createHash('sha256')
      .update(
        `${POLICY_VERSION}|2026-10-29T16:00:00.000Z|000000000000000|${AUTOMATIC_SCHEMA_VERSION}|${AUTOMATIC_AGENT_ID}`,
      )
      .digest('hex'),
  }),
)
assert.throws(
  () => migrateUp(migrationApp),
  /incompatible immutable current-flow policy/,
  'migration must reject a self-consistent cutoff with a non-PocketBase datetime format',
)

migrationRecords.length = 0
migrationLedgerCreatedField = {
  name: 'created',
  onCreate: true,
  onUpdate: false,
  type: () => 'autodate',
}
migrationLedgerRows = [
  new MockRecord('com_ledger_comercial', 'dated0000000001', {
    created: '2026-10-29 16:00:00.000Z',
  }),
]
assert.throws(
  () => migrateUp(migrationApp),
  /ambiguous current-flow recovery with preexisting created field/,
  'recovery must fail closed when created and dated rows preexist without the immutable policy',
)

console.log('nexo-curadoria current-flow runtime: PASS')
