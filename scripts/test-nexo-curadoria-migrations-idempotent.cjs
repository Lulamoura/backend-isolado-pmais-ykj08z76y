const assert = require('assert')
const fs = require('fs')
const vm = require('vm')

const MIGRATIONS = {
  proveniencia: 'pocketbase/migrations/202610012100_nexo_aprendizado_whatsapp_proveniencia.js',
  curadoria: 'pocketbase/migrations/202610012220_nexo_curadoria_comercial_unificada.js',
  hardening: 'pocketbase/migrations/202610012300_nexo_curadoria_review_hardening.js',
  failClosed: 'pocketbase/migrations/202610012330_nexo_curadoria_fail_closed.js',
  repair: 'pocketbase/migrations/202610012340_nexo_curadoria_schema_recovery.js',
  zeroAttempt: 'pocketbase/migrations/202610012350_nexo_curadoria_outbox_zero_attempt.js',
}

class Fields {
  constructor(initial = []) {
    this.items = [...initial]
  }

  getByName(name) {
    return this.items.find((item) => item.name === name) || null
  }

  add(field) {
    if (this.getByName(field.name)) throw new Error(`duplicate field: ${field.name}`)
    this.items.push(field)
  }

  removeByName(name) {
    this.items = this.items.filter((item) => item.name !== name)
  }
}

class Collection {
  constructor(config) {
    Object.assign(this, config)
    this.fields = new Fields()
    this.indexes = []
    this.records = []
  }
}

function fieldFactory(type) {
  return class {
    constructor(config) {
      Object.assign(this, config)
      if (type === 'date') {
        this.min = { toString: () => '' }
        this.max = { toString: () => '' }
      }
      this.type = this.type.bind(this)
    }

    type() {
      return type
    }
  }
}

const fieldClasses = {
  text: fieldFactory('text'),
  number: fieldFactory('number'),
  json: fieldFactory('json'),
  bool: fieldFactory('bool'),
  date: fieldFactory('date'),
}

function field(type, config) {
  return new fieldClasses[type](config)
}

function seededCollection(name, options = {}) {
  const permissive = "@request.auth.id != ''"
  const collection = new Collection({
    type: 'base',
    name,
    createRule: options.createRule === undefined ? permissive : options.createRule,
    updateRule: options.updateRule === undefined ? permissive : options.updateRule,
    deleteRule: options.deleteRule === undefined ? permissive : options.deleteRule,
    listRule: options.listRule === undefined ? permissive : options.listRule,
    viewRule: options.viewRule === undefined ? permissive : options.viewRule,
  })
  collection.fields = new Fields(options.fields || [])
  collection.indexes = [...(options.indexes || [])]
  collection.records = [...(options.records || [])]
  return collection
}

function loadMigration(file, initialCollections) {
  assert(fs.existsSync(file), `migração ausente: ${file}`)
  const collections = new Map(initialCollections.map((collection) => [collection.name, collection]))
  let up
  let down
  const sandbox = {
    migrate(apply, rollback) {
      up = apply
      down = rollback
    },
    Collection,
    TextField: fieldClasses.text,
    NumberField: fieldClasses.number,
    JSONField: fieldClasses.json,
    BoolField: fieldClasses.bool,
    DateField: fieldClasses.date,
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox)

  const app = {
    findCollectionByNameOrId(name) {
      if (!collections.has(name)) throw new Error(`missing collection: ${name}`)
      return collections.get(name)
    },
    countRecords(name) {
      const collection = collections.get(typeof name === 'string' ? name : name.name)
      if (!collection) throw new Error(`missing collection: ${name}`)
      return collection.records.length
    },
    save(collection) {
      const current = collections.get(collection.name)
      if (current && current !== collection)
        throw new Error(`duplicate collection: ${collection.name}`)
      collections.set(collection.name, collection)
    },
    delete(collection) {
      collections.delete(collection.name)
    },
  }

  assert.equal(typeof up, 'function', `up migration ausente em ${file}`)
  assert.equal(typeof down, 'function', `down migration ausente em ${file}`)
  return { app, collections, up, down }
}

function runUpTwice(runtime) {
  assert.doesNotThrow(() => runtime.up(runtime.app), 'primeiro up deve aceitar schema parcial')
  assert.doesNotThrow(() => runtime.up(runtime.app), 'segundo up deve ser idempotente')
}

function assertField(collection, name, expected) {
  const actual = collection.fields.getByName(name)
  assert(actual, `${collection.name}.${name} deve existir`)
  for (const [key, value] of Object.entries(expected)) {
    const actualValue = key === 'type' ? actual.type() : actual[key]
    assert.strictEqual(actualValue, value, `${collection.name}.${name}.${key} incompatível`)
  }
  assert.equal(
    collection.fields.items.filter((candidate) => candidate.name === name).length,
    1,
    `${collection.name}.${name} não pode duplicar`,
  )
}

function indexName(sql) {
  const match = String(sql).match(
    /^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|\[([^\]]+)\]|([^\s]+))/i,
  )
  return match ? match[1] || match[2] || match[3] : null
}

function normalizeSql(sql) {
  return String(sql).trim().replace(/\s+/g, ' ').toLowerCase()
}

function assertCanonicalIndex(collection, name, definition) {
  const matches = collection.indexes.filter((candidate) => indexName(candidate) === name)
  assert.equal(matches.length, 1, `${collection.name}.${name} deve existir uma única vez`)
  assert.equal(
    normalizeSql(matches[0]),
    normalizeSql(definition),
    `${name} deve ter definição canônica`,
  )
}

function assertPrivate(collection) {
  for (const rule of ['createRule', 'updateRule', 'deleteRule', 'listRule', 'viewRule']) {
    assert.strictEqual(collection[rule], null, `${collection.name}.${rule} deve falhar fechado`)
  }
}

function assertRollbackPreserves(runtime, names) {
  const before = new Map(
    names.map((name) => {
      const collection = runtime.collections.get(name)
      return [
        name,
        {
          fields: collection.fields.items.map((item) => ({ ...item })),
          indexes: [...collection.indexes],
          records: collection.records.map((record) => ({ ...record })),
          rules: [
            collection.createRule,
            collection.updateRule,
            collection.deleteRule,
            collection.listRule,
            collection.viewRule,
          ],
        },
      ]
    }),
  )

  assert.doesNotThrow(() => runtime.down(runtime.app), 'rollback deve ser seguro')
  for (const name of names) {
    const collection = runtime.collections.get(name)
    assert(collection, `rollback não pode excluir coleção reutilizada ${name}`)
    assert.deepStrictEqual(
      collection.fields.items.map((item) => ({ ...item })),
      before.get(name).fields,
      `${name}: campos preservados`,
    )
    assert.deepStrictEqual(
      [...collection.indexes],
      before.get(name).indexes,
      `${name}: índices preservados`,
    )
    assert.deepStrictEqual(
      collection.records,
      before.get(name).records,
      `${name}: registros preservados`,
    )
    assert.deepStrictEqual(
      [
        collection.createRule,
        collection.updateRule,
        collection.deleteRule,
        collection.listRule,
        collection.viewRule,
      ],
      before.get(name).rules,
      `${name}: ACLs preservadas no rollback`,
    )
  }
}

// A migração já aplicada no catálogo precisa continuar correta para instalações novas.
const proveniencia = loadMigration(MIGRATIONS.proveniencia, [
  seededCollection('com_nexo_aprendizado_eventos', {
    fields: [field('text', { name: 'fonte_origem', required: false, max: 160 })],
  }),
])
runUpTwice(proveniencia)
assertField(proveniencia.collections.get('com_nexo_aprendizado_eventos'), 'whatsapp_evidencia', {
  type: 'bool',
  required: false,
})
assertRollbackPreserves(proveniencia, ['com_nexo_aprendizado_eventos'])

// O catálogo ao vivo já marca 202610012100 como aplicada, embora os dez campos estejam ausentes.
// A recuperação posterior parte desse estado, materializa todo o schema permitido e não toca registros.
const repair = loadMigration(MIGRATIONS.repair, [
  seededCollection('com_nexo_aprendizado_eventos'),
  seededCollection('com_ledger_comercial', {
    fields: [field('text', { name: 'audit_id', required: true, max: 160 })],
  }),
  seededCollection('com_nexo_curadoria_decisoes'),
])
assert.doesNotThrow(
  () => repair.up(repair.app),
  'recuperação deve aceitar o estado parcial ao vivo',
)
repair.collections.get('com_nexo_curadoria_casos').indexes = [
  'CREATE INDEX idx_com_nexo_curadoria_casos_fingerprint ON com_nexo_curadoria_casos (status)',
  'CREATE INDEX idx_com_nexo_curadoria_casos_fingerprint_shadow ON com_nexo_curadoria_casos (fingerprint)',
]
assert.doesNotThrow(
  () => repair.up(repair.app),
  'recuperação deve ser idempotente e corrigir índice',
)

const repairedEventos = repair.collections.get('com_nexo_aprendizado_eventos')
for (const target of [
  ['fonte_origem', { type: 'text', required: false, max: 160 }],
  ['evidencia_status', { type: 'text', required: false, max: 80 }],
  ['whatsapp_evidencia', { type: 'bool', required: false }],
  ['whatsapp_evidencia_hash', { type: 'text', required: false, max: 160 }],
  ['whatsapp_janela_inicio', { type: 'date', required: false }],
  ['whatsapp_janela_fim', { type: 'date', required: false }],
  ['whatsapp_conversas', { type: 'number', required: false, min: 0, onlyInt: true }],
  ['whatsapp_mensagens', { type: 'number', required: false, min: 0, onlyInt: true }],
  ['whatsapp_resumo_factual', { type: 'text', required: false, max: 4000 }],
  ['conhecimento_oficial', { type: 'bool', required: false }],
]) {
  assertField(repairedEventos, target[0], target[1])
}
for (const name of [
  'com_nexo_curadoria_casos',
  'com_nexo_curadoria_evidencias',
  'com_nexo_curadoria_transicoes',
  'com_nexo_curadoria_outbox',
  'com_nexo_curadoria_outbox_auditoria',
]) {
  assert(repair.collections.has(name), `recuperação deve criar ${name}`)
  assertPrivate(repair.collections.get(name))
}
assertField(repair.collections.get('com_nexo_curadoria_casos'), 'responsavel_id', {
  type: 'text',
  required: false,
  max: 80,
})
assertField(repair.collections.get('com_nexo_curadoria_transicoes'), 'command_hash', {
  type: 'text',
  required: false,
  max: 160,
})
assertField(repair.collections.get('com_nexo_curadoria_outbox'), 'claim_expires_at', {
  type: 'date',
  required: false,
})
assertField(repair.collections.get('com_nexo_curadoria_outbox_auditoria'), 'retry_count', {
  type: 'number',
  required: true,
  min: 1,
  onlyInt: true,
})
assertField(repair.collections.get('com_ledger_comercial'), 'payload_hash', {
  type: 'text',
  required: false,
  max: 160,
})
assertCanonicalIndex(
  repair.collections.get('com_nexo_curadoria_casos'),
  'idx_com_nexo_curadoria_casos_fingerprint',
  'CREATE UNIQUE INDEX idx_com_nexo_curadoria_casos_fingerprint ON com_nexo_curadoria_casos (fingerprint)',
)
assert(
  repair.collections
    .get('com_nexo_curadoria_casos')
    .indexes.some(
      (candidate) => indexName(candidate) === 'idx_com_nexo_curadoria_casos_fingerprint_shadow',
    ),
  'recuperação deve preservar índice de nome semelhante',
)
assertCanonicalIndex(
  repair.collections.get('com_nexo_curadoria_outbox'),
  'idx_com_nexo_curadoria_outbox_claim',
  'CREATE INDEX idx_com_nexo_curadoria_outbox_claim ON com_nexo_curadoria_outbox (status, claim_expires_at, requested_at)',
)
assert.strictEqual(repair.collections.get('com_nexo_curadoria_decisoes').createRule, null)
assert.strictEqual(repair.collections.get('com_nexo_curadoria_decisoes').updateRule, null)
assert.strictEqual(repair.collections.get('com_nexo_curadoria_decisoes').deleteRule, null)
assertRollbackPreserves(repair, [
  'com_nexo_aprendizado_eventos',
  'com_ledger_comercial',
  'com_nexo_curadoria_decisoes',
  'com_nexo_curadoria_casos',
  'com_nexo_curadoria_evidencias',
  'com_nexo_curadoria_transicoes',
  'com_nexo_curadoria_outbox',
  'com_nexo_curadoria_outbox_auditoria',
])

const fingerprintIndex =
  'CREATE UNIQUE INDEX idx_com_nexo_curadoria_casos_fingerprint ON com_nexo_curadoria_casos (fingerprint)'
const curadoria = loadMigration(MIGRATIONS.curadoria, [
  seededCollection('com_nexo_curadoria_casos', {
    fields: [field('text', { name: 'fingerprint', required: true, max: 160 })],
    indexes: [
      'CREATE INDEX idx_com_nexo_curadoria_casos_fingerprint ON com_nexo_curadoria_casos (status)',
      'CREATE INDEX idx_com_nexo_curadoria_casos_fingerprint_shadow ON com_nexo_curadoria_casos (fingerprint)',
    ],
  }),
  seededCollection('com_nexo_curadoria_evidencias', {
    fields: [field('text', { name: 'caso_id', required: true, max: 80 })],
  }),
  seededCollection('com_nexo_curadoria_transicoes'),
  seededCollection('com_nexo_curadoria_outbox', {
    fields: [field('text', { name: 'caso_id', required: true, max: 80 })],
  }),
])
runUpTwice(curadoria)
for (const name of [
  'com_nexo_curadoria_casos',
  'com_nexo_curadoria_evidencias',
  'com_nexo_curadoria_transicoes',
  'com_nexo_curadoria_outbox',
]) {
  assertPrivate(curadoria.collections.get(name))
}
assertField(curadoria.collections.get('com_nexo_curadoria_casos'), 'fingerprint', {
  type: 'text',
  required: true,
  max: 160,
})
assertField(curadoria.collections.get('com_nexo_curadoria_evidencias'), 'evidencia_hash', {
  type: 'text',
  required: true,
  max: 160,
})
assertField(curadoria.collections.get('com_nexo_curadoria_transicoes'), 'transicao_chave', {
  type: 'text',
  required: true,
  max: 200,
})
assertField(curadoria.collections.get('com_nexo_curadoria_outbox'), 'idempotency_key', {
  type: 'text',
  required: true,
  max: 200,
})
assertCanonicalIndex(
  curadoria.collections.get('com_nexo_curadoria_casos'),
  'idx_com_nexo_curadoria_casos_fingerprint',
  fingerprintIndex,
)
assert(
  curadoria.collections
    .get('com_nexo_curadoria_casos')
    .indexes.some(
      (candidate) => indexName(candidate) === 'idx_com_nexo_curadoria_casos_fingerprint_shadow',
    ),
  'índice de nome semelhante deve ser preservado',
)
assertRollbackPreserves(curadoria, [
  'com_nexo_curadoria_casos',
  'com_nexo_curadoria_evidencias',
  'com_nexo_curadoria_transicoes',
  'com_nexo_curadoria_outbox',
])

const auditRetryIndex =
  'CREATE UNIQUE INDEX idx_com_nexo_curadoria_outbox_auditoria_retry ON com_nexo_curadoria_outbox_auditoria (outbox_id, retry_count)'
const hardening = loadMigration(MIGRATIONS.hardening, [
  seededCollection('com_ledger_comercial'),
  seededCollection('com_nexo_curadoria_casos'),
  seededCollection('com_nexo_curadoria_outbox'),
  seededCollection('com_nexo_curadoria_outbox_auditoria', {
    fields: [field('text', { name: 'outbox_id', required: true, max: 80 })],
    indexes: [
      'CREATE INDEX idx_com_nexo_curadoria_outbox_auditoria_retry ON com_nexo_curadoria_outbox_auditoria (status_anterior)',
      'CREATE INDEX idx_com_nexo_curadoria_outbox_auditoria_retry_shadow ON com_nexo_curadoria_outbox_auditoria (outbox_id)',
    ],
  }),
])
runUpTwice(hardening)
const auditoria = hardening.collections.get('com_nexo_curadoria_outbox_auditoria')
assertPrivate(auditoria)
assertField(auditoria, 'retry_count', { type: 'number', required: true, min: 1, onlyInt: true })
assertCanonicalIndex(auditoria, 'idx_com_nexo_curadoria_outbox_auditoria_retry', auditRetryIndex)
assert(
  auditoria.indexes.some(
    (candidate) => indexName(candidate) === 'idx_com_nexo_curadoria_outbox_auditoria_retry_shadow',
  ),
  'hardening deve preservar índice de nome semelhante',
)
assertRollbackPreserves(hardening, [
  'com_ledger_comercial',
  'com_nexo_curadoria_casos',
  'com_nexo_curadoria_outbox',
  'com_nexo_curadoria_outbox_auditoria',
])

const claimIndex =
  'CREATE INDEX idx_com_nexo_curadoria_outbox_claim ON com_nexo_curadoria_outbox (status, claim_expires_at, requested_at)'
const failClosed = loadMigration(MIGRATIONS.failClosed, [
  seededCollection('com_nexo_curadoria_transicoes'),
  seededCollection('com_nexo_curadoria_outbox', {
    indexes: [
      'CREATE INDEX idx_com_nexo_curadoria_outbox_claim ON com_nexo_curadoria_outbox (status)',
      'CREATE INDEX idx_com_nexo_curadoria_outbox_claim_shadow ON com_nexo_curadoria_outbox (claim_expires_at)',
    ],
  }),
  seededCollection('com_nexo_curadoria_decisoes'),
])
runUpTwice(failClosed)
assertField(failClosed.collections.get('com_nexo_curadoria_transicoes'), 'command_hash', {
  type: 'text',
  required: false,
  max: 160,
})
assertCanonicalIndex(
  failClosed.collections.get('com_nexo_curadoria_outbox'),
  'idx_com_nexo_curadoria_outbox_claim',
  claimIndex,
)
assert(
  failClosed.collections
    .get('com_nexo_curadoria_outbox')
    .indexes.some(
      (candidate) => indexName(candidate) === 'idx_com_nexo_curadoria_outbox_claim_shadow',
    ),
  'fail-closed deve preservar índice de nome semelhante',
)
assert.strictEqual(failClosed.collections.get('com_nexo_curadoria_decisoes').createRule, null)
assert.strictEqual(failClosed.collections.get('com_nexo_curadoria_decisoes').updateRule, null)
assert.strictEqual(failClosed.collections.get('com_nexo_curadoria_decisoes').deleteRule, null)
assertRollbackPreserves(failClosed, [
  'com_nexo_curadoria_transicoes',
  'com_nexo_curadoria_outbox',
  'com_nexo_curadoria_decisoes',
])

// Coleções novas da Curadoria com dados não podem receber campos obrigatórios/índices únicos
// por convergência automática. A migração deve diagnosticar antes de tocar o schema existente.
for (const populatedPartial of [
  {
    file: MIGRATIONS.curadoria,
    target: 'com_nexo_curadoria_casos',
    collections: [
      seededCollection('com_nexo_curadoria_casos', {
        fields: [field('text', { name: 'fingerprint', required: true, max: 160 })],
        records: [{ id: 'caso-existente', preserved: true }],
      }),
      seededCollection('com_nexo_curadoria_evidencias'),
      seededCollection('com_nexo_curadoria_transicoes'),
      seededCollection('com_nexo_curadoria_outbox'),
    ],
  },
  {
    file: MIGRATIONS.hardening,
    target: 'com_nexo_curadoria_outbox_auditoria',
    collections: [
      seededCollection('com_ledger_comercial'),
      seededCollection('com_nexo_curadoria_casos'),
      seededCollection('com_nexo_curadoria_outbox'),
      seededCollection('com_nexo_curadoria_outbox_auditoria', {
        fields: [field('text', { name: 'outbox_id', required: true, max: 80 })],
        records: [{ id: 'auditoria-existente', preserved: true }],
      }),
    ],
  },
  {
    file: MIGRATIONS.repair,
    target: 'com_nexo_curadoria_casos',
    collections: [
      seededCollection('com_nexo_aprendizado_eventos'),
      seededCollection('com_ledger_comercial'),
      seededCollection('com_nexo_curadoria_decisoes'),
      seededCollection('com_nexo_curadoria_casos', {
        fields: [field('text', { name: 'fingerprint', required: true, max: 160 })],
        records: [{ id: 'caso-existente', preserved: true }],
      }),
    ],
  },
]) {
  const runtime = loadMigration(populatedPartial.file, populatedPartial.collections)
  const target = runtime.collections.get(populatedPartial.target)
  const before = {
    fields: [...target.fields.items],
    indexes: [...target.indexes],
    records: target.records.map((record) => ({ ...record })),
    rules: [
      target.createRule,
      target.updateRule,
      target.deleteRule,
      target.listRule,
      target.viewRule,
    ],
  }
  assert.throws(
    () => runtime.up(runtime.app),
    new RegExp(`populated partial Curadoria collection ${populatedPartial.target}`, 'i'),
    `${populatedPartial.file} deve diagnosticar coleção parcial populada`,
  )
  assert.deepStrictEqual(
    target.fields.items,
    before.fields,
    `${populatedPartial.target}: campos intactos`,
  )
  assert.deepStrictEqual(
    target.indexes,
    before.indexes,
    `${populatedPartial.target}: índices intactos`,
  )
  assert.deepStrictEqual(
    target.records,
    before.records,
    `${populatedPartial.target}: registros intactos`,
  )
  assert.deepStrictEqual(
    [target.createRule, target.updateRule, target.deleteRule, target.listRule, target.viewRule],
    before.rules,
    `${populatedPartial.target}: ACLs intactas antes do diagnóstico`,
  )
}

// Mesmo que outra validação aborte, as migrações de segurança começam fechando decisões.
for (const secureFailure of [
  {
    file: MIGRATIONS.failClosed,
    collections: [
      seededCollection('com_nexo_curadoria_transicoes', {
        fields: [field('text', { name: 'command_hash', required: false, max: 80 })],
      }),
      seededCollection('com_nexo_curadoria_outbox'),
      seededCollection('com_nexo_curadoria_decisoes'),
    ],
  },
  {
    file: MIGRATIONS.repair,
    collections: [
      seededCollection('com_nexo_aprendizado_eventos', {
        fields: [field('text', { name: 'fonte_origem', required: true, max: 160 })],
      }),
      seededCollection('com_ledger_comercial'),
      seededCollection('com_nexo_curadoria_decisoes'),
    ],
  },
]) {
  const runtime = loadMigration(secureFailure.file, secureFailure.collections)
  assert.throws(() => runtime.up(runtime.app), /incompatible field/i)
  const decisions = runtime.collections.get('com_nexo_curadoria_decisoes')
  assert.strictEqual(
    decisions.createRule,
    null,
    `${secureFailure.file}: create deve falhar fechado`,
  )
  assert.strictEqual(
    decisions.updateRule,
    null,
    `${secureFailure.file}: update deve falhar fechado`,
  )
  assert.strictEqual(
    decisions.deleteRule,
    null,
    `${secureFailure.file}: delete deve falhar fechado`,
  )
}

for (const incompatible of [
  {
    file: MIGRATIONS.proveniencia,
    collections: [
      seededCollection('com_nexo_aprendizado_eventos', {
        fields: [field('number', { name: 'fonte_origem', required: false, max: 160 })],
      }),
    ],
    field: 'fonte_origem',
  },
  {
    file: MIGRATIONS.repair,
    collections: [
      seededCollection('com_nexo_aprendizado_eventos', {
        fields: [field('text', { name: 'fonte_origem', required: true, max: 160 })],
      }),
      seededCollection('com_ledger_comercial'),
      seededCollection('com_nexo_curadoria_decisoes'),
    ],
    field: 'fonte_origem',
  },
  {
    file: MIGRATIONS.curadoria,
    collections: [
      seededCollection('com_nexo_curadoria_casos', {
        fields: [field('text', { name: 'fingerprint', required: false, max: 160 })],
      }),
      seededCollection('com_nexo_curadoria_evidencias'),
      seededCollection('com_nexo_curadoria_transicoes'),
      seededCollection('com_nexo_curadoria_outbox'),
    ],
    field: 'fingerprint',
  },
  {
    file: MIGRATIONS.hardening,
    collections: [
      seededCollection('com_ledger_comercial', {
        fields: [field('text', { name: 'payload_hash', required: false, max: 80 })],
      }),
      seededCollection('com_nexo_curadoria_casos'),
      seededCollection('com_nexo_curadoria_outbox'),
      seededCollection('com_nexo_curadoria_outbox_auditoria'),
    ],
    field: 'payload_hash',
  },
  {
    file: MIGRATIONS.failClosed,
    collections: [
      seededCollection('com_nexo_curadoria_transicoes', {
        fields: [field('text', { name: 'command_hash', required: false, max: 80 })],
      }),
      seededCollection('com_nexo_curadoria_outbox'),
      seededCollection('com_nexo_curadoria_decisoes'),
    ],
    field: 'command_hash',
  },
]) {
  const runtime = loadMigration(incompatible.file, incompatible.collections)
  assert.throws(
    () => runtime.up(runtime.app),
    new RegExp(
      `incompatible field.*${incompatible.field}|${incompatible.field}.*incompatible field`,
      'i',
    ),
    `${incompatible.file} deve falhar fechado para metadados incompatíveis`,
  )
}

const zeroAttempt = loadMigration(MIGRATIONS.zeroAttempt, [
  seededCollection('com_nexo_curadoria_outbox', {
    fields: [field('number', { name: 'tentativas', required: true, min: 0 })],
    records: [{ id: 'outbox-existing', tentativas: 0, preserved: true }],
  }),
])
assert.doesNotThrow(
  () => zeroAttempt.up(zeroAttempt.app),
  'zero-attempt up deve aceitar required=true',
)
assertField(zeroAttempt.collections.get('com_nexo_curadoria_outbox'), 'tentativas', {
  type: 'number',
  required: false,
  min: 0,
})
assert.doesNotThrow(
  () => zeroAttempt.up(zeroAttempt.app),
  'zero-attempt up deve ser idempotente com required=false',
)
assertRollbackPreserves(zeroAttempt, ['com_nexo_curadoria_outbox'])

for (const incompatibleZeroAttempt of [
  {
    label: 'coleção ausente',
    collections: [],
    pattern: /incompatible collection com_nexo_curadoria_outbox: missing/i,
  },
  {
    label: 'tipo de coleção incompatível',
    collections: [Object.assign(seededCollection('com_nexo_curadoria_outbox'), { type: 'view' })],
    pattern: /incompatible collection com_nexo_curadoria_outbox: type/i,
  },
  {
    label: 'campo ausente',
    collections: [seededCollection('com_nexo_curadoria_outbox')],
    pattern: /incompatible field com_nexo_curadoria_outbox\.tentativas: missing/i,
  },
  {
    label: 'tipo de campo incompatível',
    collections: [
      seededCollection('com_nexo_curadoria_outbox', {
        fields: [field('text', { name: 'tentativas', required: true, min: 0 })],
      }),
    ],
    pattern: /incompatible field com_nexo_curadoria_outbox\.tentativas: type/i,
  },
  {
    label: 'mínimo incompatível',
    collections: [
      seededCollection('com_nexo_curadoria_outbox', {
        fields: [field('number', { name: 'tentativas', required: true, min: 1 })],
      }),
    ],
    pattern: /incompatible field com_nexo_curadoria_outbox\.tentativas: min/i,
  },
]) {
  const runtime = loadMigration(MIGRATIONS.zeroAttempt, incompatibleZeroAttempt.collections)
  assert.throws(
    () => runtime.up(runtime.app),
    incompatibleZeroAttempt.pattern,
    `zero-attempt deve falhar fechado para ${incompatibleZeroAttempt.label}`,
  )
}

console.log('nexo-curadoria migrations idempotent: PASS')
