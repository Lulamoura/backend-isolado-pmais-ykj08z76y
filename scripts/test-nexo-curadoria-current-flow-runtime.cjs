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

const rows = [
  ledger('historical', '2026-10-19 09:00:00.000Z'),
  ledger('ledger-before-cutoff-id', CUTOFF_CREATED),
  ledger('routine', '2026-10-20 11:00:00.000Z'),
  ledger('missing-proof', '2026-10-20 12:00:00.000Z', {
    evidencia_ref: '',
    confianca: 'media',
    destino_sugerido: 'curadoria',
    tipo_evento: 'objecao_comercial',
    fato: 'Objeção comercial sem prova suficiente precisa de validação.',
  }),
  ledger('sensitive', '2026-10-20 13:00:00.000Z', {
    fato: 'Cliente pediu desconto no preço e alteração de política comercial.',
  }),
  ledger('conflict', '2026-10-20 14:00:00.000Z', {
    tipo_evento: 'followup',
    fato: 'Novo follow-up contradiz a regra vigente.',
  }),
  ledger('noise', '2026-10-20 15:00:00.000Z', {
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
  com_parametros: [parameter],
  com_ledger_comercial: rows,
  com_nexo_curadoria_casos: [activeRule, historicalMatchingCase],
  com_nexo_curadoria_evidencias: [],
  com_nexo_curadoria_transicoes: [],
  com_nexo_curadoria_outbox: [],
}
let nextId = 1
let saves = 0
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
function invoke(body) {
  let response
  route({
    auth: actor,
    requestInfo: () => ({ body }),
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
assert.equal(preview.payload.human_exceptions, 3)
assert.equal(preview.payload.noise_ignored, 1)
assert.equal(saves, 0)

const applied = invoke({ dry_run: false, confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL' })
assert.equal(applied.status, 200)
assert.equal(applied.payload.automatic_cases, 1)
assert.equal(applied.payload.human_exceptions, 3)
assert.equal(applied.payload.noise_ignored, 1)
assert.equal(applied.payload.historical_untouched, 2)
assert.equal(collections.com_nexo_curadoria_casos.length, 6)
assert.equal(collections.com_nexo_curadoria_outbox.length, 1)

const automaticCase = collections.com_nexo_curadoria_casos.find((item) =>
  item.getBool('automatic_promotion_allowed'),
)
assert(automaticCase)
assert.equal(automaticCase.getString('status'), 'aprovado')
assert.equal(automaticCase.getString('conhecimento_status'), 'pendente_publicacao')
assert.equal(automaticCase.getBool('human_review_required'), false)
assert.equal(automaticCase.getString('validado_por'), AUTOMATIC_AGENT_ID)
assert.equal(automaticCase.getString('created_by'), AUTOMATIC_AGENT_ID)
assert.equal(automaticCase.getString('updated_by'), AUTOMATIC_AGENT_ID)

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
assert.equal(humanCases.length, 3)
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
function invokeProcessor() {
  let processResponse
  processRoute({
    auth: actor,
    requestInfo: () => ({ body: { limite: 10 } }),
    request: {
      header: {
        get: (name) =>
          name === 'Origin' ? 'https://backend-isolado-pmais-43b9c--preview.goskip.app' : '',
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

automaticTransition.set('ator_id', 'nexo')
let rejected = invokeProcessor()
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
rejected = invokeProcessor()
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
rejected = invokeProcessor()
assert.equal(rejected.status, 200)
assert.equal(rejected.payload.falhas, 1)
assert.equal(gatewayCalls.length, 0, 'arbitrary configured automatic identity must fail closed')
automaticSecrets.PMAIS_CURADORIA_AUTOMATIC_AGENT_ID = AUTOMATIC_AGENT_ID
resetOutboxForRetry()

const processResponse = invokeProcessor()
assert.equal(processResponse.status, 200)
assert.equal(processResponse.payload.processados, 1)
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

const replay = invoke({ dry_run: false, confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL' })
assert.equal(replay.status, 200)
assert.equal(replay.payload.casos_criados, 0)
assert.equal(replay.payload.evidencias_criadas, 0)
assert.equal(collections.com_nexo_curadoria_outbox.length, 1)

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
