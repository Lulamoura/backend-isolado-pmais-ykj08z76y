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
  getBool(name) {
    return Boolean(this.values[name])
  }
  getFloat(name) {
    return Number(this.values[name] || 0)
  }
  getInt(name) {
    return Number(this.values[name] || 0)
  }
  set(name, value) {
    this.values[name] = value
  }
}

const ledger = []
const businesses = [
  new MockRecord('com_negocios', 'business-1', {
    oe_numero: 'OE-301',
    necessidade: 'Serviço recorrente',
    empresa_id: 'company-1',
    contato_principal_id: 'contact-1',
    responsavel_id: 'user-1',
    equipe_id: 'team-1',
  }),
  new MockRecord('com_negocios', 'business-technical-only', {
    oe_numero: '',
    titulo: '',
    necessidade: '',
    empresa_id: 'company-1',
    contato_principal_id: 'contact-1',
    responsavel_id: 'user-1',
    equipe_id: 'team-1',
  }),
]
const collections = {
  com_ledger_comercial: ledger,
  com_negocios: businesses,
  com_empresas: [new MockRecord('com_empresas', 'company-1', { nome: 'Cliente A' })],
  com_contatos: [new MockRecord('com_contatos', 'contact-1', { nome: 'Contato A' })],
  users: [new MockRecord('users', 'user-1', { name: 'Responsável A' })],
  com_propostas: [
    new MockRecord('com_propostas', 'proposal-1', {
      negocio_id: 'business-1',
      identificador: 'PROP-301',
    }),
  ],
}
let nextId = 1

const app = {
  findCollectionByNameOrId(name) {
    return { name }
  },
  findRecordById(collection, id) {
    const record = (collections[collection] || []).find((item) => item.id === id)
    if (!record) throw new Error('not found')
    return record
  },
  findRecordsByFilter(collection, filter) {
    const rows = collections[collection] || []
    const auditMatch = String(filter || '').match(/audit_id\s*=\s*'([^']+)'/)
    if (!auditMatch) return rows
    return rows.filter((row) => row.getString('audit_id') === auditMatch[1])
  },
  save(record) {
    const name = record.collection.name || record.collection
    if (!record.id) {
      record.id = `ledger-generated-${nextId++}`
      if (!collections[name]) collections[name] = []
      collections[name].push(record)
    }
  },
}

function RecordCtor(collection) {
  return new MockRecord(collection, '', {})
}

const createHooks = {}
const updateHooks = {}
const context = {
  console,
  Date,
  JSON,
  Math,
  Record: RecordCtor,
  $app: app,
  $security: { sha256: (value) => `hash:${value}` },
  onRecordAfterCreateSuccess(callback, collection) {
    createHooks[collection] = callback
  },
  onRecordAfterUpdateSuccess(callback, collection) {
    updateHooks[collection] = callback
  },
}
vm.createContext(context)

const hookPath = 'pocketbase/hooks/com_ledger_eventos_comerciais.js'
assert(fs.existsSync(hookPath), 'hook unificado de produtores comerciais deve existir')
vm.runInContext(fs.readFileSync(hookPath, 'utf8'), context)

for (const collection of ['com_atividades', 'com_proposta_versoes', 'com_negocio_historico']) {
  assert(createHooks[collection], `produtor de criação ausente: ${collection}`)
  assert(updateHooks[collection], `produtor de atualização ausente: ${collection}`)
}

function run(callback, record) {
  let nextCalls = 0
  callback({
    record,
    next() {
      nextCalls++
    },
  })
  assert.equal(nextCalls, 1)
}

const activity = new MockRecord('com_atividades', 'activity-1', {
  negocio_id: 'business-1',
  tipo: 'reuniao',
  estado: 'realizada',
  descricao: 'Reunião de alinhamento comercial.',
  resultado: 'Cliente pediu novo resumo da proposta.',
  canal: 'video',
  responsavel_id: 'user-1',
  updated: '2026-10-01 10:00:00.000Z',
  created: '2026-10-01 09:00:00.000Z',
})
run(createHooks.com_atividades, activity)
run(createHooks.com_atividades, activity)

const proposalVersion = new MockRecord('com_proposta_versoes', 'proposal-version-1', {
  proposta_id: 'proposal-1',
  numero: '2',
  estado: 'enviada',
  valor_total_centavos: '150000',
  updated: '2026-10-01 11:00:00.000Z',
  created: '2026-10-01 11:00:00.000Z',
})
run(createHooks.com_proposta_versoes, proposalVersion)

const history = new MockRecord('com_negocio_historico', 'history-1', {
  negocio_id: 'business-1',
  etapa_anterior: 'producao_proposta',
  etapa_novo: 'negociacao',
  justificativa: 'Proposta apresentada ao cliente.',
  usuario_id: 'user-1',
  updated: '2026-10-01 12:00:00.000Z',
  created: '2026-10-01 12:00:00.000Z',
})
run(createHooks.com_negocio_historico, history)

const technicalOnlyActivity = new MockRecord('com_atividades', 'activity-technical-only', {
  negocio_id: 'business-technical-only',
  tipo: 'ligacao',
  estado: 'realizada',
  descricao: 'Contato comercial sem número humano ainda.',
  responsavel_id: 'user-1',
  updated: '2026-10-01 13:00:00.000Z',
  created: '2026-10-01 13:00:00.000Z',
})
run(createHooks.com_atividades, technicalOnlyActivity)

assert.equal(ledger.length, 4, 'replay idempotente não pode duplicar fatos')
assert.deepEqual(ledger.map((row) => row.getString('fonte')).sort(), [
  'atividade_comercial',
  'atividade_comercial',
  'negocio_historico',
  'proposta_comercial',
])
for (const row of ledger.slice(0, 3)) {
  assert.equal(row.getString('negocio_ref'), 'OE-301')
  assert.equal(row.getString('empresa_nome'), 'Cliente A')
  assert.equal(row.getString('contato_nome'), 'Contato A')
  assert.equal(row.getString('responsavel'), 'Responsável A')
  assert(row.getString('evidencia_ref'))
  assert(row.getString('audit_id'))
  assert.equal(row.getString('status'), 'novo')
  assert.equal(row.getString('negocio_id'), 'business-1')
  assert.equal(row.getString('responsavel_id'), 'user-1')
  assert.equal(row.getString('equipe_id'), 'team-1')
  assert(row.getString('payload_hash'))
}
const technicalOnlyLedger = ledger.find(
  (row) => row.getString('evidencia_ref') === 'com_atividades:activity-technical-only',
)
assert(technicalOnlyLedger)
assert.equal(technicalOnlyLedger.getString('negocio_ref'), '')
assert.equal(
  technicalOnlyLedger.getString('negocio_ref').includes('business-technical-only'),
  false,
)
assert.equal(
  ledger.some((row) => row.getString('fonte').includes('whatsapp_send')),
  false,
)

console.log('ledger-eventos-comerciais runtime: PASS')
