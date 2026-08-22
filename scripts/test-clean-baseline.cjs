const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '..')
const migrationsDir = path.join(root, 'pocketbase/migrations')
const migrationFiles = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.js'))
const migrationPath = path.join(migrationsDir, '0001_baseline_pmais_v1.js')
const source = fs.readFileSync(migrationPath, 'utf8')
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'pocketbase/BASELINE_MANIFEST.json'), 'utf8'),
)

class FieldStore {
  constructor(fields = []) {
    this.items = [...fields]
  }
  getByName(name) {
    return this.items.find((field) => field.name === name) || null
  }
  add(field) {
    this.items.push(field)
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

class App {
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
    this.records = new Map()
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
      this.collections.set(value.name, value)
      return
    }
    if (value instanceof Record) {
      const records = this.records.get(value.collection.name) || []
      records.push(value)
      this.records.set(value.collection.name, records)
      return
    }
    throw new Error('unsupported save')
  }
  delete(collection) {
    this.collections.delete(collection.name)
    this.records.delete(collection.name)
  }
}

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

const app = new App()
callbacks.up(app)
const appliedSeedCounts = Object.fromEntries(
  [...app.records].map(([name, records]) => [name, records.length]),
)
const transactionalCollections = [
  'com_empresas',
  'com_negocios',
  'com_contatos',
  'com_propostas',
  'com_proposta_versoes',
  'com_atividades',
  'com_auditoria',
  'com_negocio_historico',
]
const history = app.findCollectionByNameOrId('com_qualificacao_historico')
const usersAfterUp = app.findCollectionByNameOrId('users')

const seedTotal = Object.values(manifest.structuralSeeds).reduce((sum, value) => sum + value, 0)
const checks = [
  ['há exatamente uma migration ativa', migrationFiles.length === 1],
  ['a migration ativa é a baseline esperada', migrationFiles[0] === '0001_baseline_pmais_v1.js'],
  ['a baseline registra um único par up/down', Boolean(callbacks?.up && callbacks?.down)],
  [
    '30 coleções finais: 29 criadas + users existente',
    manifest.collections.created === 29 &&
      manifest.collections.existingAuth === 1 &&
      manifest.collections.total === 30,
  ],
  ['nenhum usuário é importado pela baseline', manifest.users.imported === 0],
  [
    'campos comerciais de users estão previstos',
    JSON.stringify(manifest.users.extensionFields) ===
      JSON.stringify(['perfil_id', 'equipe_id', 'ativo_comercial']),
  ],
  [
    'somente sementes estruturais estão presentes',
    seedTotal > 0 && manifest.transactionalSeeds === 0,
  ],
  ['não há senhas ou tokens embutidos', !/(password|passwordConfirm|tokenKey)/i.test(source)],
  ['baseline exige backend vazio', source.includes('A baseline exige backend vazio')],
  [
    'regra final do histórico é superadministrador-only',
    source.includes('com_qualificacao_historico') &&
      source.includes("@request.auth.perfil_id.slug = 'superadministrador'"),
  ],
  ['up cria exatamente 30 coleções', app.collections.size === 30],
  [
    'up grava exatamente as sementes declaradas',
    Object.entries(manifest.structuralSeeds).every(
      ([name, expected]) => (appliedSeedCounts[name] || 0) === expected,
    ) && Object.values(appliedSeedCounts).reduce((sum, value) => sum + value, 0) === seedTotal,
  ],
  [
    'coleções transacionais não recebem sementes',
    transactionalCollections.every((name) => !app.records.has(name)),
  ],
  ['users permanece sem registros', !app.records.has('users')],
  [
    'users recebe os três campos comerciais',
    manifest.users.extensionFields.every((name) => usersAfterUp.fields.getByName(name)),
  ],
  [
    'regra materializada do histórico é superadministrador-only',
    history.listRule.includes("slug = 'superadministrador'") &&
      history.viewRule.includes("slug = 'superadministrador'"),
  ],
]

let failures = 0
for (const [name, ok] of checks) {
  if (ok) console.log('✓ ' + name)
  else {
    failures += 1
    console.error('✗ ' + name)
  }
}
if (failures) process.exit(1)
callbacks.down(app)
const rollbackOk =
  app.collections.size === 1 &&
  app.collections.has('users') &&
  manifest.users.extensionFields.every(
    (name) => !app.findCollectionByNameOrId('users').fields.getByName(name),
  )
if (!rollbackOk) {
  console.error('✗ down restaura o backend inicial')
  process.exit(1)
}
console.log('✓ down restaura o backend inicial')
console.log(
  '\n' +
    (checks.length + 1) +
    '/' +
    (checks.length + 1) +
    ' contratos aprovados; ' +
    seedTotal +
    ' sementes estruturais',
)
