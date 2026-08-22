const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

const migration0068 = read('pocketbase/migrations/0068_create_com_qualificacao_historico.js')
const migration0069 = read(
  'pocketbase/migrations/0069_loosen_com_negocios_required_and_restrict_historico.js',
)
const migration0079Path = path.join(
  root,
  'pocketbase/migrations/0079_enforce_qualificacao_historico_rules.js',
)
const migration0079 = fs.existsSync(migration0079Path)
  ? fs.readFileSync(migration0079Path, 'utf8')
  : ''

function carregarMigration(source) {
  let callbacks
  class Collection {
    constructor(definition) {
      Object.assign(this, definition)
      this.id = definition.id || definition.name
    }
  }
  vm.runInNewContext(source, {
    Collection,
    migrate(up, down) {
      callbacks = { up, down }
    },
  })
  return callbacks
}

function criarApp() {
  const campos = new Map(
    ['tipo_entrada', 'qualificacao', 'prospectivo'].map((name) => [name, { name, required: true }]),
  )
  const colecoes = new Map([
    [
      'com_negocios',
      {
        id: 'com_negocios',
        name: 'com_negocios',
        fields: { getByName: (name) => campos.get(name) || null },
      },
    ],
  ])
  return {
    colecoes,
    findCollectionByNameOrId(name) {
      const collection = colecoes.get(name)
      if (!collection) throw new Error(`missing collection: ${name}`)
      return collection
    },
    save(collection) {
      colecoes.set(collection.name, collection)
    },
    delete(collection) {
      colecoes.delete(collection.name)
    },
  }
}

function simularOrdem(ordem) {
  const app = criarApp()
  const migrations = {
    '0068': carregarMigration(migration0068),
    '0069': carregarMigration(migration0069),
    '0079': carregarMigration(migration0079),
  }
  for (const number of ordem) migrations[number].up(app)
  return app.findCollectionByNameOrId('com_qualificacao_historico')
}

let ordemNormalOk = false
let ordemSkipOk = false
try {
  const hist = simularOrdem(['0068', '0069', '0079'])
  ordemNormalOk = hist.listRule?.includes("slug = 'superadministrador'")
} catch (_) {}
try {
  const hist = simularOrdem(['0069', '0068', '0079'])
  ordemSkipOk = hist.listRule?.includes("slug = 'superadministrador'")
} catch (_) {}

const checks = [
  [
    '0069 tolera coleção de histórico ainda ausente no up',
    /encontrarColecaoOpcional\(app, ["']com_qualificacao_historico["']\)/.test(migration0069) &&
      migration0069.includes('if (hist) {'),
  ],
  [
    '0069 tolera coleção de histórico ainda ausente no down',
    migration0069.match(/encontrarColecaoOpcional\(app, ["']com_qualificacao_historico["']\)/g)
      ?.length >= 2,
  ],
  ['0079 existe como reconciliação posterior obrigatória', Boolean(migration0079)],
  [
    '0079 exige a coleção após a cadeia histórica',
    /findCollectionByNameOrId\(["']com_qualificacao_historico["']\)/.test(migration0079),
  ],
  [
    '0079 aplica regra de superadministrador no histórico',
    migration0079.includes("@request.auth.perfil_id.slug = 'superadministrador'") &&
      migration0079.includes('hist.listRule = SUPERADMIN_ONLY') &&
      migration0079.includes('hist.viewRule = SUPERADMIN_ONLY'),
  ],
  [
    '0079 não cria nem remove registros',
    !/new Record|deleteRecord|save\s*\(\s*new Record/.test(migration0079),
  ],
  ['ordem normal 0068→0069→0079 termina restrita', ordemNormalOk],
  ['ordem anômala SKIP 0069→0068→0079 termina restrita', ordemSkipOk],
]

let failures = 0
for (const [name, ok] of checks) {
  if (ok) console.log(`✓ ${name}`)
  else {
    failures += 1
    console.error(`✗ ${name}`)
  }
}

if (failures) {
  console.error(`\n${failures}/${checks.length} contratos falharam`)
  process.exit(1)
}

console.log(`\n${checks.length}/${checks.length} contratos aprovados`)
