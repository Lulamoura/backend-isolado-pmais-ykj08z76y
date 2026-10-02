const assert = require('assert')
const fs = require('fs')
const vm = require('vm')

class MockRecord {
  constructor(collection, id, values) {
    this.collection = collection
    this.id = id || ''
    this.values = { ...(values || {}) }
  }
  getString(name) {
    const value = this.values[name]
    return value === undefined || value === null ? '' : String(value)
  }
  set(name, value) {
    this.values[name] = value
  }
}

const ledger = []
let nextId = 1
const sourceSecrets = {
  activecampaign: 'activecampaign-secret',
  reuniao_externa: 'meeting-secret',
}
const app = {
  findCollectionByNameOrId(name) {
    return { name }
  },
  findRecordsByFilter(collection, filter) {
    if (collection !== 'com_ledger_comercial') return []
    const auditMatch = String(filter || '').match(/audit_id\s*=\s*'([^']+)'/)
    if (!auditMatch) return ledger
    return ledger.filter((row) => row.getString('audit_id') === auditMatch[1])
  },
  save(record) {
    if (!record.id) {
      record.id = `ledger-${nextId++}`
      ledger.push(record)
    }
  },
}

function RecordCtor(collection) {
  return new MockRecord(collection, '', {})
}

const routes = {}
const context = {
  console,
  Date,
  JSON,
  Math,
  Record: RecordCtor,
  $app: app,
  $os: { getenv: () => '' },
  $http: { send: () => ({ statusCode: 500, json: {}, raw: '' }) },
  $security: {
    sha256: (value) => `hash:${value}`,
    hs256: (value, secret) => `signature:${secret}:${value}`,
  },
  $secrets: {
    get(name) {
      if (name === 'NEXO_ACTIVE_CAMPAIGN_EVENT_INGEST_SECRET') return sourceSecrets.activecampaign
      if (name === 'NEXO_REUNIAO_EVENT_INGEST_SECRET') return sourceSecrets.reuniao_externa
      return ''
    },
  },
  $apis: {
    bodyLimit: () => function () {},
    requireAuth: () => function () {},
  },
  routerAdd(method, path, callback) {
    routes[`${method} ${path}`] = callback
  },
}
vm.createContext(context)
vm.runInContext(
  fs.readFileSync('pocketbase/hooks/com_nexo_central_operacional.js', 'utf8'),
  context,
)

const route = routes['POST /backend/v1/nexo/curadoria/fontes/{source}/eventos/{eventId}']
assert(route, 'contrato autenticado de fontes comerciais deve existir')

function invoke({
  source = 'activecampaign',
  eventId = 'event-001',
  signingSource = source,
  signature,
  body,
}) {
  const requestBody = body || {
    occurred_at: '2026-10-01T12:00:00-03:00',
    business_ref: 'OE-401',
    company: 'Cliente A',
    contact: 'Contato A',
    responsible: 'Equipe 1',
    event_type: 'deal_note',
    summary: 'Cliente registrou preferência por proposta resumida.',
    destination: 'curadoria',
    risk: 'baixo',
    confidence: 'alta',
  }
  const canonicalPayload = JSON.stringify({
    occurred_at: String(requestBody.occurred_at || ''),
    business_ref: String(requestBody.business_ref || ''),
    company: String(requestBody.company || ''),
    contact: String(requestBody.contact || ''),
    responsible: String(requestBody.responsible || ''),
    event_type: String(requestBody.event_type || ''),
    summary: String(requestBody.summary || ''),
    destination: String(requestBody.destination || 'historico'),
    risk: String(requestBody.risk || 'medio'),
    confidence: String(requestBody.confidence || 'media'),
  })
  const payloadHash = `hash:${canonicalPayload}`
  const sourceSecret = sourceSecrets[signingSource] || ''
  const providedSignature =
    signature === undefined
      ? `signature:${sourceSecret}:${source}.${eventId}.${payloadHash}`
      : signature
  let response = null
  const e = {
    request: {
      pathValue(name) {
        if (name === 'source') return source
        if (name === 'eventId') return eventId
        return ''
      },
      header: {
        get(name) {
          return name === 'X-PMAIS-Event-Signature' ? providedSignature : ''
        },
      },
    },
    requestInfo() {
      return {
        body: requestBody,
      }
    },
    json(status, payload) {
      response = { status, payload }
      return response
    },
  }
  route(e)
  return response
}

const accepted = invoke({})
assert.equal(accepted.status, 202)
assert.equal(accepted.payload.accepted, true)
assert.equal(accepted.payload.created, true)
assert.equal(accepted.payload.automatic_send_allowed, false)
assert.equal(ledger.length, 1)
assert.equal(ledger[0].getString('fonte'), 'activecampaign')
assert.equal(ledger[0].getString('negocio_ref'), 'OE-401')
assert.equal(ledger[0].getString('destino_sugerido'), 'curadoria')
assert.equal(ledger[0].getString('evidencia_ref'), 'activecampaign:event-001')
assert(ledger[0].getString('payload_hash'))

sourceSecrets.reuniao_externa = sourceSecrets.activecampaign
const sharedSecretRejected = invoke({ eventId: 'event-shared-secret' })
assert.equal(sharedSecretRejected.status, 503)
assert.equal(sharedSecretRejected.payload.error, 'SEGREDOS_FONTES_NAO_DISTINTOS')
sourceSecrets.reuniao_externa = 'meeting-secret'

const replay = invoke({})
assert.equal(replay.status, 200)
assert.equal(replay.payload.created, false)
assert.equal(ledger.length, 1)

const divergentReplay = invoke({
  body: {
    occurred_at: '2026-10-01T12:00:00-03:00',
    business_ref: 'OE-401',
    company: 'Cliente A',
    event_type: 'deal_note',
    summary: 'Conteúdo divergente para o mesmo ID externo.',
  },
})
assert.equal(divergentReplay.status, 409)
assert.equal(divergentReplay.payload.error, 'EVENT_ID_PAYLOAD_CONFLICT')
assert.equal(ledger.length, 1)

assert.equal(invoke({ signature: 'wrong' }).status, 401)
assert.equal(
  invoke({ source: 'reuniao_externa', eventId: 'meeting-1', signingSource: 'activecampaign' })
    .status,
  401,
)
assert.equal(invoke({ source: 'fonte-nao-aprovada' }).status, 400)
assert.equal(
  invoke({
    eventId: 'event-raw',
    body: {
      occurred_at: '2026-10-01T12:00:00-03:00',
      business_ref: 'OE-401',
      event_type: 'deal_note',
      summary: 'Resumo válido.',
      raw_payload: { secret: 'não deve entrar' },
    },
  }).status,
  400,
)

sourceSecrets.activecampaign = ''
assert.equal(invoke({ signature: '' }).status, 503)
assert.equal(ledger.length, 1)

console.log('nexo-curadoria-fontes-ingest runtime: PASS')
