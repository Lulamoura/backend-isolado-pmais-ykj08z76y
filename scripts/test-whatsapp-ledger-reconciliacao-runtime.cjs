const assert = require('assert')
const fs = require('fs')
const vm = require('vm')

class MockRecord {
  constructor(id, values) {
    this.id = id
    this.values = { ...(values || {}) }
  }
  getString(name) {
    const value = this.values[name]
    return value === null || value === undefined ? '' : String(value)
  }
  getBool(name) {
    return Boolean(this.values[name])
  }
  get(name) {
    return this.values[name]
  }
  set(name, value) {
    this.values[name] = value
  }
}

const profile = new MockRecord('profile-admin', {
  ativo: true,
  slug: 'superadministrador',
})
const actor = new MockRecord('user-admin', {
  ativo_comercial: true,
  perfil_id: profile.id,
})

const vinculo = new MockRecord('link-1', {
  provider: 'uazapi',
  instance_name: 'operadora-1',
  owner: 'owner-1',
  chat_id: '5581999999999@s.whatsapp.net',
  contato_id: 'contact-1',
  empresa_id: 'company-1',
  negocio_id: 'business-1',
  negocio_ids: ['business-1'],
  status: 'vinculado_manual',
  origem_decisao: 'decisao_humana_fila_ambiguidades',
})
const vinculoPendente = new MockRecord('link-2', {
  provider: 'uazapi',
  instance_name: 'operadora-1',
  owner: 'owner-1',
  chat_id: '5581888888888@s.whatsapp.net',
  contato_id: 'contact-1',
  empresa_id: 'company-1',
  negocio_id: 'business-1',
  negocio_ids: ['business-1'],
  status: 'pendente_confirmacao',
})
const vinculoLegado = new MockRecord('link-legacy', {
  provider: 'uazapi',
  instance_name: 'operadora-1',
  owner: 'owner-1',
  chat_id: '5581777777777@s.whatsapp.net',
  contato_id: 'contact-1',
  empresa_id: 'company-1',
  negocio_id: 'business-1',
  negocio_ids: ['business-1'],
  status: 'vinculado',
  origem_decisao: 'estado_legado_governado',
})

const mensagens = [
  new MockRecord('message-row-1', {
    provider: 'uazapi',
    instance_name: 'operadora-1',
    owner: 'owner-1',
    chat_id: '5581999999999@s.whatsapp.net',
    message_id: 'provider-message-1',
    evento_id: 'event-row-1',
  }),
  new MockRecord('message-row-2', {
    provider: 'uazapi',
    instance_name: 'operadora-1',
    owner: 'owner-1',
    chat_id: '5581999999999@s.whatsapp.net',
    message_id: 'provider-message-2',
    evento_id: 'event-row-2',
  }),
  new MockRecord('message-row-3', {
    provider: 'uazapi',
    instance_name: 'operadora-1',
    owner: 'owner-1',
    chat_id: '5581999999999@s.whatsapp.net',
    message_id: 'provider-message-3',
    evento_id: 'event-row-3',
  }),
  new MockRecord('message-row-pending', {
    provider: 'uazapi',
    instance_name: 'operadora-1',
    owner: 'owner-1',
    chat_id: '5581888888888@s.whatsapp.net',
    message_id: 'provider-message-pending',
    evento_id: 'event-row-pending',
  }),
  new MockRecord('message-row-legacy', {
    provider: 'uazapi',
    instance_name: 'operadora-1',
    owner: 'owner-1',
    chat_id: '5581777777777@s.whatsapp.net',
    message_id: 'provider-message-legacy',
    evento_id: 'event-row-legacy',
  }),
]

const ledgerEligible = new MockRecord('ledger-1', {
  fonte: 'whatsapp_uazapi',
  evidencia_ref: 'event-row-1',
  contato_nome: '',
  empresa_nome: '',
  negocio_ref: '',
})
const ledgerConflict = new MockRecord('ledger-2', {
  fonte: 'whatsapp_uazapi',
  evidencia_ref: 'event-row-2',
  contato_nome: 'Contato correto',
  empresa_nome: 'Empresa correta',
  negocio_ref: 'Outro negócio já governado',
})
const ledgerPending = new MockRecord('ledger-pending', {
  fonte: 'whatsapp_uazapi',
  evidencia_ref: 'event-row-pending',
  contato_nome: '',
  empresa_nome: '',
  negocio_ref: '',
})
const ledgerPartialConflict = new MockRecord('ledger-3', {
  fonte: 'whatsapp_uazapi',
  evidencia_ref: 'event-row-3',
  contato_nome: 'Apelido preservado',
  empresa_nome: '',
  negocio_ref: '',
})
const ledgerLegacy = new MockRecord('ledger-legacy', {
  fonte: 'whatsapp_uazapi',
  evidencia_ref: 'event-row-legacy',
  contato_nome: '',
  empresa_nome: '',
  negocio_ref: '',
})

const collections = {
  com_perfis: [profile],
  com_whatsapp_vinculos: [vinculo, vinculoPendente, vinculoLegado],
  com_whatsapp_mensagens: mensagens,
  com_ledger_comercial: [
    ledgerEligible,
    ledgerConflict,
    ledgerPending,
    ledgerPartialConflict,
    ledgerLegacy,
  ],
  com_contatos: [new MockRecord('contact-1', { nome: 'Contato correto' })],
  com_empresas: [new MockRecord('company-1', { nome: 'Empresa correta' })],
  com_negocios: [
    new MockRecord('business-1', {
      oe_numero: 'OE-101',
      necessidade: 'Serviço recorrente',
      empresa_id: 'company-1',
      contato_principal_id: 'contact-1',
    }),
  ],
}

const app = {
  findRecordById(collection, id) {
    const record = (collections[collection] || []).find((item) => item.id === id)
    if (!record) throw new Error('not found')
    return record
  },
  findRecordsByFilter(collection, _filter, _sort, limit, offset) {
    const rows = collections[collection] || []
    return rows.slice(offset || 0, (offset || 0) + (limit || rows.length))
  },
  save(_record) {},
  runInTransaction(callback) {
    return callback(this)
  },
}

const routes = {}
const context = {
  console,
  Date,
  JSON,
  Math,
  Record: function () {},
  Collection: function () {},
  TextField: function () {},
  JSONField: function () {},
  DateField: function () {},
  BoolField: function () {},
  $app: app,
  $secrets: { get: () => '' },
  $security: { sha256: (value) => `hash:${value}` },
  $apis: { bodyLimit: () => function () {} },
  routerAdd(method, path, callback) {
    routes[`${method} ${path}`] = callback
  },
}
vm.createContext(context)
vm.runInContext(fs.readFileSync('pocketbase/hooks/com_whatsapp_uazapi_webhook.js', 'utf8'), context)

const route = routes['POST /backend/v1/integracao/whatsapp/uazapi/ledger/reconciliar']
assert(route, 'rota governada de reconciliação do ledger deve existir')

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function invoke(body) {
  let response = null
  const e = {
    auth: actor,
    requestInfo() {
      return { body: body || {} }
    },
    json(status, payload) {
      response = { status, payload }
      return response
    },
    unauthorizedError(message) {
      response = { status: 401, payload: { message } }
      return response
    },
    forbiddenError(message) {
      response = { status: 403, payload: { message } }
      return response
    },
  }
  route(e)
  return response
}

const vinculoAntes = clone(vinculo.values)
const dryRun = invoke({ dry_run: true })
assert.equal(dryRun.status, 200)
assert.equal(dryRun.payload.dry_run, true)
assert.equal(dryRun.payload.registros_elegiveis, 3)
assert.equal(dryRun.payload.conflitos_preservados, 2)
assert.equal(dryRun.payload.registros_atualizados, 0)
assert.equal(ledgerEligible.getString('negocio_ref'), '')
assert.deepEqual(vinculo.values, vinculoAntes, 'dry-run não pode alterar vínculo')

const semConfirmacao = invoke({ dry_run: false })
assert.equal(semConfirmacao.status, 400)
assert.equal(ledgerEligible.getString('negocio_ref'), '')

const apply = invoke({
  dry_run: false,
  confirmacao: 'APLICAR_RECONCILIACAO_LEDGER_WHATSAPP',
})
assert.equal(apply.status, 200)
assert.equal(apply.payload.dry_run, false)
assert.equal(apply.payload.registros_atualizados, 3)
assert.equal(ledgerEligible.getString('contato_nome'), 'Contato correto')
assert.equal(ledgerEligible.getString('empresa_nome'), 'Empresa correta')
assert.match(ledgerEligible.getString('negocio_ref'), /OE-101/)
assert.equal(ledgerConflict.getString('negocio_ref'), 'Outro negócio já governado')
assert.equal(ledgerPartialConflict.getString('contato_nome'), 'Apelido preservado')
assert.equal(ledgerPartialConflict.getString('empresa_nome'), 'Empresa correta')
assert.match(ledgerPartialConflict.getString('negocio_ref'), /OE-101/)
assert.equal(ledgerPending.getString('negocio_ref'), '')
assert.match(ledgerLegacy.getString('negocio_ref'), /OE-101/)
assert.deepEqual(vinculo.values, vinculoAntes, 'aplicação não pode alterar decisão humana')

const secondApply = invoke({
  dry_run: false,
  confirmacao: 'APLICAR_RECONCILIACAO_LEDGER_WHATSAPP',
})
assert.equal(secondApply.status, 200)
assert.equal(secondApply.payload.registros_atualizados, 0)
assert.equal(secondApply.payload.registros_ja_alinhados, 2)
assert.equal(secondApply.payload.automatic_send_allowed, false)

console.log('whatsapp-ledger-reconciliacao runtime: PASS')
