const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const relay = fs.readFileSync(
  path.resolve(__dirname, '../pocketbase/hooks/ac_native_relay.js'),
  'utf8',
)
const start = relay.indexOf('    function clean(')
const end = relay.indexOf('    function envelope(', start)
assert.ok(start >= 0 && end > start, 'dispatcher source block not found')
const dispatcherSource = `${relay.slice(start, end)}\n;({ proveloDispatch })`

class MockRecord {
  constructor() {
    this.data = {}
  }
  set(key, value) {
    this.data[key] = value
  }
  getString(key) {
    return String(this.data[key] || '')
  }
  getBool(key) {
    return this.data[key] === true
  }
}

function scenario(options = {}) {
  const events = []
  const saves = []
  const config = new MockRecord()
  config.set('habilitada', options.enabled === true)
  config.set('endpoint', options.endpoint || 'https://hook.us1.make.com/synthetic-test')
  const prior = options.prior
    ? Object.assign(new MockRecord(), {
        data: {
          idempotency_key: crypto.createHash('sha256').update('provelo-draft|4812').digest('hex'),
          status: options.prior,
        },
      })
    : null
  const app = {
    findFirstRecordByData(collection, key, value) {
      if (collection === 'com_integracao_provelo') {
        if (options.configMissing) throw new Error('not found')
        return config
      }
      if (collection === 'com_eventos_integracao') {
        const found = [prior, ...events].find(
          (item) => item && item.getString(key) === String(value),
        )
        if (!found) throw new Error('not found')
        return found
      }
      throw new Error(`unexpected collection ${collection}`)
    },
    findCollectionByNameOrId(name) {
      return name
    },
    save(record) {
      if (record !== config && !events.includes(record)) events.push(record)
      saves.push({ record, snapshot: { ...record.data } })
    },
  }
  let requestConfig = null
  const http = {
    send(config) {
      requestConfig = config
      const draft = events.find((item) => item.getString('evento_tipo') === 'draft_requested')
      assert.equal(draft && draft.getString('status'), 'pending', 'pending must precede HTTP')
      if (options.timeout) throw new Error('timeout')
      return {
        statusCode: options.statusCode || 200,
        json:
          options.responseJson === undefined
            ? { success: true, ProveloID: 'synthetic-provelo-id' }
            : options.responseJson,
      }
    },
  }
  const sandbox = {
    $app: app,
    $http: http,
    $security: {
      sha256(value) {
        return crypto.createHash('sha256').update(value).digest('hex')
      },
    },
    Record: MockRecord,
    Date,
    Error,
    JSON,
    Math,
    Number,
    String,
    isFinite,
  }
  const { proveloDispatch } = vm.runInNewContext(dispatcherSource, sandbox)
  const deal = { id: '4812', value: 123456, cdate: '2026-08-31T10:00:00Z' }
  const pipeline = { title: options.pipeline || 'Proposta Qualificada' }
  const stage = options.stage || 'Negociação'
  const contact = {
    email: options.email === undefined ? 'synthetic@example.invalid' : options.email,
  }
  const custom = {
    Modalidade: options.modality === undefined ? 'Serv. Eventual' : options.modality,
    ProveloID: options.proveloId || '',
    Responsável: options.owner === undefined ? 'synthetic-owner' : options.owner,
  }
  const result = proveloDispatch(deal, pipeline, stage, contact, custom)
  return { result, events, saves, config, requestConfig }
}

function findEvent(state, type) {
  return state.events.find((item) => item.getString('evento_tipo') === type)
}

const gateOff = scenario()
assert.deepEqual(JSON.parse(JSON.stringify(gateOff.result)), {
  attempted: false,
  reason: 'GATE_DESLIGADO',
  audit_recorded: true,
  replay: false,
})
assert.equal(findEvent(gateOff, 'draft_skipped').getString('status'), 'processed')
assert.deepEqual(JSON.parse(findEvent(gateOff, 'draft_skipped').getString('payload')), {
  deal_id: '4812',
  attempted: false,
  reason: 'GATE_DESLIGADO',
})

const skipped = [
  [{ enabled: true, pipeline: 'Outro Pipeline' }, 'PIPELINE_FORA_DO_ESCOPO'],
  [{ enabled: true, stage: 'Qualificação' }, 'ETAPA_FORA_DO_ESCOPO'],
  [{ enabled: true, proveloId: 'PV-1' }, 'PROVELO_ID_EXISTENTE'],
  [{ enabled: true, modality: '' }, 'MODALIDADE_AUSENTE'],
  [{ enabled: true, email: '' }, 'DADOS_OBRIGATORIOS_AUSENTES'],
]
for (const [options, reason] of skipped) {
  const state = scenario(options)
  assert.equal(state.result.attempted, false)
  assert.equal(state.result.reason, reason)
  assert.equal(findEvent(state, 'draft_skipped').getString('status'), 'processed')
}

const replay = scenario({ enabled: true, prior: 'processed' })
assert.equal(replay.result.reason, 'DISPATCH_JA_REGISTRADO')
assert.equal(replay.result.status, 'processed')
assert.equal(findEvent(replay, 'draft_requested'), undefined)

const success = scenario({ enabled: true })
assert.deepEqual(JSON.parse(JSON.stringify(success.result)), {
  attempted: true,
  accepted: true,
  uncertain: false,
})
assert.equal(findEvent(success, 'draft_requested').getString('status'), 'processed')
assert.ok(success.saves.some((item) => item.snapshot.status === 'pending'))
assert.deepEqual(JSON.parse(success.requestConfig.body), {
  DealId: '4812',
  Modalidade: 'Serv. Eventual',
  Email: 'synthetic@example.invalid',
  Vendedor: 'synthetic-owner',
  ValorServico: '  1.234,56',
})
assert.deepEqual(JSON.parse(JSON.stringify(success.requestConfig.headers)), {
  'Content-Type': 'application/json',
})

const successWithRealPipelineName = scenario({
  enabled: true,
  pipeline: 'Propostas Qualificadas',
})
assert.equal(successWithRealPipelineName.result.accepted, true)
assert.equal(
  findEvent(successWithRealPipelineName, 'draft_requested').getString('status'),
  'processed',
)

const failure = scenario({ enabled: true, statusCode: 503 })
assert.equal(failure.result.accepted, false)
assert.equal(failure.result.uncertain, false)
assert.equal(findEvent(failure, 'draft_requested').getString('status'), 'failed')

const missingAck = scenario({ enabled: true, responseJson: {} })
assert.equal(missingAck.result.accepted, false)
assert.equal(missingAck.result.uncertain, true)
assert.equal(findEvent(missingAck, 'draft_requested').getString('status'), 'uncertain')
assert.equal(
  JSON.parse(findEvent(missingAck, 'draft_requested').getString('payload')).result,
  'ack_missing',
)

const uncertain = scenario({ enabled: true, timeout: true })
assert.equal(uncertain.result.accepted, false)
assert.equal(uncertain.result.uncertain, true)
assert.equal(findEvent(uncertain, 'draft_requested').getString('status'), 'uncertain')
assert.equal(
  JSON.parse(findEvent(uncertain, 'draft_requested').getString('payload')).result,
  'timeout',
)

for (const state of [gateOff, replay, success, failure, missingAck, uncertain]) {
  for (const event of state.events) {
    const payload = event.getString('payload')
    assert.ok(!payload.includes('synthetic@example.invalid'))
    assert.ok(!payload.includes('synthetic-owner'))
    assert.ok(!payload.includes('hook.us1.make.com'))
  }
}

console.log('PASS Provelo dispatcher behavioral scenarios 13/13')
