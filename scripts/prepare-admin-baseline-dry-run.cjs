const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '..')
const migrationPath = path.join(root, 'pocketbase/migrations/0001_baseline_pmais_v1.js')
const manifestPath = path.join(root, 'pocketbase/BASELINE_MANIFEST.json')
const outputPath = path.resolve(
  root,
  '../../output/aplicacao-comercial-pmais/t62-r2-admin-baseline-dry-run.json',
)

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    )
  }
  return value
}

function stableJson(value) {
  return JSON.stringify(canonical(value))
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

class FieldStore {
  constructor(fields = []) {
    this.items = fields.map((field) => ({ ...field }))
  }
  getByName(name) {
    return this.items.find((field) => field.name === name) || null
  }
  add(field) {
    this.items.push({ ...field })
  }
  removeByName(name) {
    this.items = this.items.filter((field) => field.name !== name)
  }
}

class Collection {
  constructor(definition) {
    Object.assign(this, definition)
    this.id = definition.id || definition.name
    this.fields = new FieldStore(definition.fields)
  }
}

class Record {
  constructor(collection) {
    this.collection = collection
    this.data = {}
  }
  set(key, value) {
    this.data[key] = value
  }
}

function collectionPayload(collection) {
  return {
    ...Object.fromEntries(Object.entries(collection).filter(([key]) => key !== 'fields')),
    fields: collection.fields.items.map((field) => ({ ...field })),
  }
}

function skeletonPayload(payload) {
  const relationFields = payload.fields.filter((field) => field.type === 'relation')
  const relationNames = relationFields.map((field) => field.name)
  return {
    ...payload,
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: payload.fields.filter((field) => field.type !== 'relation'),
    indexes: (payload.indexes || []).filter(
      (index) => !relationNames.some((name) => index.includes(name)),
    ),
  }
}

class CaptureApp {
  constructor() {
    this.collections = new Map([
      [
        'users',
        new Collection({
          id: '_pb_users_auth_',
          name: 'users',
          type: 'auth',
          listRule: 'id = @request.auth.id',
          viewRule: 'id = @request.auth.id',
          createRule: '',
          updateRule: 'id = @request.auth.id',
          deleteRule: 'id = @request.auth.id',
          fields: [
            { name: 'id', type: 'text' },
            { name: 'email', type: 'email' },
          ],
        }),
      ],
    ])
    this.operations = []
    this.records = new Map()
    this.normalizations = []
  }
  findCollectionByNameOrId(name) {
    const collection =
      this.collections.get(name) ||
      [...this.collections.values()].find((candidate) => candidate.id === name)
    if (!collection) throw new Error('missing collection: ' + name)
    return collection
  }
  save(value) {
    if (value instanceof Collection) {
      const exists = this.collections.has(value.name)
      this.collections.set(value.name, value)
      this.operations.push({
        type: exists ? 'update_collection' : 'create_collection',
        collection: value.name,
        payload: collectionPayload(value),
      })
      return
    }
    if (value instanceof Record) {
      const payload = { ...value.data }
      for (const field of value.collection.fields.items.filter(
        (candidate) =>
          candidate.type === 'relation' && candidate.collectionId === '_pb_users_auth_',
      )) {
        if (payload[field.name]) {
          payload[field.name] = ''
          this.normalizations.push({
            collection: value.collection.name,
            field: field.name,
            action: 'clear_legacy_user_reference',
          })
        }
      }
      const records = this.records.get(value.collection.name) || []
      records.push(payload)
      this.records.set(value.collection.name, records)
      this.operations.push({
        type: 'create_record',
        collection: value.collection.name,
        payload,
      })
      return
    }
    throw new Error('unsupported save')
  }
  delete() {
    throw new Error('dry-run never executes rollback writes')
  }
}

function fail(message) {
  throw new Error(message)
}

const source = fs.readFileSync(migrationPath, 'utf8')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
let callbacks
const context = {
  Collection,
  RelationField: class RelationField {
    constructor(definition) {
      Object.assign(this, definition)
    }
  },
  BoolField: class BoolField {
    constructor(definition) {
      Object.assign(this, definition)
    }
  },
  Record,
  migrate(up, down) {
    callbacks = { up, down }
  },
}
vm.runInNewContext(source, context)
if (!callbacks?.up) fail('baseline up callback not found')

const app = new CaptureApp()
callbacks.up(app)

const createCollections = app.operations.filter(
  (operation) => operation.type === 'create_collection',
)
const updateCollections = app.operations.filter(
  (operation) => operation.type === 'update_collection',
)
const createRecords = app.operations.filter((operation) => operation.type === 'create_record')
const collectionIds = new Map(
  [...app.collections.values()].map((collection) => [collection.id, collection.name]),
)
const collectionNames = new Set(app.collections.keys())
const structuralIds = new Map()

for (const operation of createRecords) {
  const id = operation.payload.id
  if (!id || !/^[a-z0-9]{15}$/.test(id)) {
    fail(`invalid deterministic id in ${operation.collection}`)
  }
  const key = `${operation.collection}:${id}`
  if (structuralIds.has(key)) fail(`duplicate seed id: ${key}`)
  structuralIds.set(key, operation.payload)
}

for (const operation of createCollections) {
  const payload = operation.payload
  if (!payload.id || !payload.name || !payload.type) fail('incomplete collection payload')
  const fieldNames = payload.fields.map((field) => field.name)
  if (fieldNames.length !== new Set(fieldNames).size) fail(`duplicate field in ${payload.name}`)
  for (const field of payload.fields.filter((candidate) => candidate.type === 'relation')) {
    if (!collectionIds.has(field.collectionId)) {
      fail(`unknown relation target ${field.collectionId} in ${payload.name}.${field.name}`)
    }
  }
}

for (const operation of createRecords) {
  const collection = app.findCollectionByNameOrId(operation.collection)
  for (const field of collection.fields.items.filter(
    (candidate) => candidate.type === 'relation',
  )) {
    const value = operation.payload[field.name]
    if (value === undefined || value === null || value === '') continue
    const values = Array.isArray(value) ? value : [value]
    const targetName = collectionIds.get(field.collectionId)
    if (!targetName) fail(`unknown record relation target in ${operation.collection}.${field.name}`)
    for (const targetId of values) {
      if (targetName === 'users') {
        fail(`structural seed references a user in ${operation.collection}.${field.name}`)
      }
      if (!structuralIds.has(`${targetName}:${targetId}`)) {
        fail(`missing seed relation ${targetName}:${targetId}`)
      }
    }
  }
}

const seedCounts = Object.fromEntries(
  Object.keys(manifest.structuralSeeds).map((name) => [name, (app.records.get(name) || []).length]),
)
const totalSeeds = Object.values(seedCounts).reduce((sum, count) => sum + count, 0)
const expectedSeeds = Object.values(manifest.structuralSeeds).reduce((sum, count) => sum + count, 0)
const expectedSeedCounts = stableJson(manifest.structuralSeeds)
const actualSeedCounts = stableJson(seedCounts)
if (expectedSeedCounts !== actualSeedCounts) fail('seed counts differ from manifest')

if (createCollections.length !== 29) fail('expected 29 collection creates')
if (updateCollections.length !== 1 || updateCollections[0].collection !== 'users') {
  fail('expected exactly one users update')
}
if (app.collections.size !== 30) fail('expected 30 final collections')
if (totalSeeds !== 167 || totalSeeds !== expectedSeeds) fail('expected 167 structural seeds')
if (app.records.has('users')) fail('users must remain empty')
if (!collectionNames.has('com_qualificacao_historico')) fail('missing qualification history')
if (app.normalizations.length !== 4) fail('expected four legacy user-reference normalizations')

const forbiddenCollections = new Set([
  'users',
  'com_empresas',
  'com_negocios',
  'com_contatos',
  'com_propostas',
  'com_proposta_versoes',
  'com_atividades',
  'com_auditoria',
  'com_negocio_historico',
  'com_qualificacao_historico',
])
for (const name of forbiddenCollections) {
  if ((seedCounts[name] || 0) !== 0) fail(`transactional/user seed found in ${name}`)
}

const twoPassOperations = [
  ...createCollections.map((operation) => ({
    type: 'create_collection_skeleton',
    collection: operation.collection,
    payload: skeletonPayload(operation.payload),
  })),
  ...createCollections.map((operation) => ({
    type: 'apply_collection_definition',
    collection: operation.collection,
    payload: operation.payload,
  })),
  ...updateCollections,
  ...createRecords,
]

for (const operation of twoPassOperations.filter(
  (candidate) => candidate.type === 'create_collection_skeleton',
)) {
  if (operation.payload.fields.some((field) => field.type === 'relation')) {
    fail(`relation leaked into skeleton ${operation.collection}`)
  }
  if (
    ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule'].some(
      (key) => operation.payload[key] !== null,
    )
  ) {
    fail(`rule leaked into skeleton ${operation.collection}`)
  }
}

const serializedOperations = twoPassOperations.map((operation, index) => ({
  sequence: index + 1,
  ...operation,
  fingerprint: sha256(stableJson(operation)),
}))
const sensitivePattern = /password|passwordConfirm|tokenKey|@pmaisservicos\.com\.br/i
if (sensitivePattern.test(stableJson(serializedOperations))) fail('sensitive material detected')

const report = {
  format: 'pmais-admin-baseline-dry-run/v1',
  mode: 'dry-run',
  generatedAt: new Date().toISOString(),
  source: {
    migration: 'pocketbase/migrations/0001_baseline_pmais_v1.js',
    migrationSha256: sha256(source),
    manifest: 'pocketbase/BASELINE_MANIFEST.json',
    manifestSha256: sha256(fs.readFileSync(manifestPath)),
  },
  guarantees: {
    networkRequests: 0,
    writeRequests: 0,
    users: 0,
    transactionalSeeds: 0,
  },
  summary: {
    operations: serializedOperations.length,
    createCollectionSkeletons: createCollections.length,
    applyCollectionDefinitions: createCollections.length,
    updateCollections: updateCollections.length,
    createRecords: createRecords.length,
    finalCollections: app.collections.size,
    seedCounts,
    normalizations: app.normalizations.length,
    expectedSchemaLedgerEvents: 59,
  },
  normalizations: app.normalizations,
  operationsFingerprint: sha256(stableJson(serializedOperations)),
  operations: serializedOperations,
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true, mode: 0o700 })
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 })

console.log(
  JSON.stringify(
    {
      outputPath,
      summary: report.summary,
      guarantees: report.guarantees,
      migrationSha256: report.source.migrationSha256,
      operationsFingerprint: report.operationsFingerprint,
    },
    null,
    2,
  ),
)
