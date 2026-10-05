const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '..')
const signature = 'a'.repeat(64)

function loadRoute(file, routePath, context) {
  const routes = []
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), {
    ...context,
    routerAdd(method, registeredPath, handler) {
      routes.push({ method, path: registeredPath, handler })
    },
  })
  const route = routes.find((item) => item.path === routePath)
  assert.ok(route, `route ${routePath} should be registered`)
  return route.handler
}

function responseEvent(body, headers = {}) {
  let response = null
  return {
    event: {
      request: {
        body: JSON.stringify(body),
        header: {
          get(name) {
            return (
              headers[name] ||
              {
                'Content-Type': 'application/json',
                'X-AC-Signature': signature,
                'X-Correlation-Id': body && body.correlation_id,
              }[name] ||
              ''
            )
          },
        },
      },
      json(status, payload) {
        response = { status, payload }
        return response
      },
    },
    getResponse() {
      return response
    },
  }
}

const webhook = loadRoute(
  'pocketbase/hooks/ac_webhook.js',
  '/backend/v1/integracao/ac/webhook',
  {
    $apis: { bodyLimit: () => function bodyLimit() {} },
    $secrets: { get: () => 'test-secret' },
    $security: {
      hs256: () => signature,
      sha256: (value) => `hash:${value}`,
    },
    $app: {
      findFirstRecordByData(collection) {
        if (collection === 'com_parametros') {
          return {
            getBool: () => true,
            getString: () => 'true',
          }
        }
        return {
          getString: () => JSON.stringify({ record_id: 'existing-record' }),
        }
      },
    },
    toString: (value) => String(value),
  },
)

function webhookPayload(data) {
  const now = new Date().toISOString()
  return {
    schema_version: '1',
    event_id: `test:${Math.random()}`,
    source: 'activecampaign',
    entity_type: 'business',
    entity_id: '123',
    action: 'upsert',
    occurred_at: now,
    source_version: now,
    correlation_id: 't6-ac8-shape-test',
    data,
    links: { company_id: '1', contact_id: '2', owner_code: 'Vendedor 1' },
  }
}

function callWebhook(payload) {
  const capture = responseEvent(payload)
  assert.doesNotThrow(() => webhook(capture.event))
  return capture.getResponse()
}

assert.deepEqual(JSON.parse(JSON.stringify(callWebhook(webhookPayload(null)))), {
  status: 400,
  payload: { error: 'ENVELOPE_INVALIDO', field: 'data' },
})

const reconciliation = loadRoute(
  'pocketbase/hooks/com_ac_reconciliacao.js',
  '/backend/v1/integracao/ac/reconciliacao/simular',
  {
    $apis: {
      bodyLimit: () => function bodyLimit() {},
      requireAuth: () => function requireAuth() {},
    },
    $secrets: { get: () => '' },
    $security: { sha256: (value) => `hash:${value}` },
    $http: { send: () => assert.fail('synthetic validation must not call ActiveCampaign') },
    $app: {
      findRecordById(collection) {
        if (collection === 'com_perfis') return { getString: () => 'superadministrador' }
        throw new Error(`unexpected findRecordById ${collection}`)
      },
      findFirstRecordByData(collection, field, key) {
        if (collection !== 'com_parametros') throw new Error(`unexpected collection ${collection}`)
        if (key === 'ac_reconciliation_enabled' || key === 'ac_synthetic_preview_enabled') {
          return { getBool: () => true, getString: () => 'true' }
        }
        throw new Error(`missing test parameter ${key}`)
      },
    },
    Record: function Record() {},
  },
)

function callSynthetic(syntheticEvent) {
  let response = null
  const actor = {
    id: 'actor-1',
    getBool: () => true,
    getString: () => 'profile-1',
  }
  const event = {
    auth: actor,
    requestInfo: () => ({ body: { mode: 'synthetic', synthetic_events: [syntheticEvent] } }),
    json(status, payload) {
      response = { status, payload }
      return response
    },
    unauthorizedError: (message) => ({ status: 401, message }),
    forbiddenError: (message) => ({ status: 403, message }),
  }
  assert.doesNotThrow(() => reconciliation(event))
  return response
}

const syntheticBase = {
  schema_version: '1',
  event_id: 'test:shape-validation',
  source: 'activecampaign',
  entity_type: 'business',
  entity_id: '123',
  action: 'upsert',
  occurred_at: new Date().toISOString(),
  source_version: new Date().toISOString(),
  correlation_id: 't6-ac8-shape-validation',
  test_marker: '[TESTE]',
  links: {},
}

assert.deepEqual(JSON.parse(JSON.stringify(callSynthetic({ ...syntheticBase, data: null }))), {
  status: 400,
  payload: { error: 'EVENTO_SINTETICO_INVALIDO', field: 'data', index: 0 },
})

const malformedLinks = JSON.parse(
  JSON.stringify(callSynthetic({ ...syntheticBase, data: {}, links: null })),
)
assert.deepEqual(malformedLinks, {
  status: 400,
  payload: { error: 'EVENTO_SINTETICO_INVALIDO', field: 'links', index: 0 },
})

process.stdout.write('PASS signed webhook and synthetic reconciliation validate event object shapes\n')
