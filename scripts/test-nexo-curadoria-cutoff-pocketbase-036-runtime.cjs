const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const pocketbase = process.env.POCKETBASE_BIN
assert(pocketbase, 'POCKETBASE_BIN must point to a PocketBase 0.36.x binary')
assert(fs.existsSync(pocketbase), `PocketBase binary not found: ${pocketbase}`)

const originalMigration = '202610291300_nexo_curadoria_fluxo_corrente.js'
const recoveryMigration = '202610291700_nexo_curadoria_fluxo_corrente_recovery.js'
for (const name of [originalMigration, recoveryMigration]) {
  assert(
    fs.existsSync(path.join(root, 'pocketbase', 'migrations', name)),
    `required current-flow migration missing: ${name}`,
  )
}

const workspace = fs.mkdtempSync(
  path.join(process.env.TMPDIR || os.tmpdir(), 'nexo-curadoria-cutoff-pb036-'),
)
const dataDirectory = path.join(workspace, 'data')
const migrationsDirectory = path.join(workspace, 'migrations')
const ambiguousDataDirectory = path.join(workspace, 'ambiguous-data')
const ambiguousMigrationsDirectory = path.join(workspace, 'ambiguous-migrations')
const legacyDataDirectory = path.join(workspace, 'legacy-data')
const legacyMigrationsDirectory = path.join(workspace, 'legacy-migrations')
const hooksDirectory = path.join(workspace, 'empty-hooks')
fs.mkdirSync(migrationsDirectory, { recursive: true })
fs.mkdirSync(ambiguousMigrationsDirectory, { recursive: true })
fs.mkdirSync(legacyMigrationsDirectory, { recursive: true })
fs.mkdirSync(hooksDirectory, { recursive: true })

const setupMigration = `migrate(function(app) {
  var ledger = new Collection({ type: 'base', name: 'com_ledger_comercial', createRule: null, updateRule: null, deleteRule: null, listRule: null, viewRule: null })
  ledger.fields.add(new TextField({ name: 'audit_id', required: true, max: 160 }))
  app.save(ledger)
  for (var i = 0; i < 3; i++) {
    var old = new Record(ledger)
    old.id = 'old00000000000' + i
    old.set('audit_id', 'historical-' + i)
    app.save(old)
  }

  var cases = new Collection({ type: 'base', name: 'com_nexo_curadoria_casos', createRule: null, updateRule: null, deleteRule: null, listRule: null, viewRule: null })
  cases.fields.add(new TextField({ name: 'fingerprint', required: true, max: 160 }))
  app.save(cases)
  var oldCase = new Record(cases)
  oldCase.id = 'oldcase00000001'
  oldCase.set('fingerprint', 'historical-case')
  app.save(oldCase)

  var parametros = new Collection({ type: 'base', name: 'com_parametros', createRule: null, updateRule: null, deleteRule: null, listRule: null, viewRule: null })
  parametros.fields.add(new TextField({ name: 'chave', required: true, max: 180 }))
  parametros.fields.add(new TextField({ name: 'valor', required: true, max: 10000 }))
  parametros.fields.add(new TextField({ name: 'descricao', required: false, max: 500 }))
  parametros.fields.add(new TextField({ name: 'tipo', required: true, max: 80 }))
  parametros.fields.add(new BoolField({ name: 'ativo', required: false }))
  parametros.fields.add(new NumberField({ name: 'versao', required: false, min: 0, onlyInt: true }))
  parametros.indexes = ['CREATE UNIQUE INDEX idx_com_parametros_chave ON com_parametros (chave)']
  app.save(parametros)
}, function(_) {})
`

const assertionMigration = `migrate(function(app) {
  var POLICY_KEY = 'nexo.curadoria.fluxo_corrente_v1'
  var POLICY_VERSION = 'pmais_nexo_auto_promotion_policy_v1'
  var AUTOMATIC_SCHEMA_VERSION = 'pmais_nexo_curadoria_conhecimento_automatico_v1'
  var AUTOMATIC_AGENT_ID = 'nexo-curadoria-automatico'
  var ledger = app.findCollectionByNameOrId('com_ledger_comercial')
  var createdField = ledger.fields.getByName('created')
  if (!createdField || createdField.type() !== 'autodate' || !createdField.onCreate || createdField.onUpdate)
    throw new Error('created must be immutable on-create autodate')
  var cases = app.findCollectionByNameOrId('com_nexo_curadoria_casos')
  var casesCreatedField = cases.fields.getByName('created')
  if (!casesCreatedField || casesCreatedField.type() !== 'autodate' || !casesCreatedField.onCreate || casesCreatedField.onUpdate)
    throw new Error('cases created must be immutable on-create autodate')
  var oldCase = app.findRecordById('com_nexo_curadoria_casos', 'oldcase00000001')
  if (oldCase.getString('created')) throw new Error('historical cases must not be backfilled')
  var freshCase = new Record(cases)
  freshCase.id = 'newcase00000001'
  freshCase.set('fingerprint', 'post-cutoff-case')
  app.save(freshCase)
  if (!freshCase.getString('created')) throw new Error('new cases must receive created automatically')

  var policyRows = app.findRecordsByFilter('com_parametros', "chave = '" + POLICY_KEY + "'", '', 10, 0)
  if (policyRows.length !== 1) throw new Error('exactly one immutable current-flow policy required')
  var parameter = policyRows[0]
  var policy = JSON.parse(parameter.getString('valor') || '{}')
  var cutoff = policy.cutoff || {}
  if (!/^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$/.test(String(cutoff.created || '')))
    throw new Error('cutoff.created must use PocketBase lexical datetime format')
  if (cutoff.id !== '000000000000000') throw new Error('cutoff.id must be the minimal PocketBase id sentinel')
  var expectedHash = String($security.sha256([
    POLICY_VERSION,
    cutoff.created,
    cutoff.id,
    AUTOMATIC_SCHEMA_VERSION,
    AUTOMATIC_AGENT_ID,
  ].join('|')))
  if (!parameter.getBool('ativo') || parameter.getString('tipo') !== 'json_imutavel' || parameter.getInt('versao') !== 1)
    throw new Error('policy envelope invalid')
  if (policy.policy_version !== POLICY_VERSION || policy.automatic_schema_version !== AUTOMATIC_SCHEMA_VERSION || policy.automatic_agent_id !== AUTOMATIC_AGENT_ID || policy.integrity_hash !== expectedHash)
    throw new Error('policy content invalid')

  var oldRows = app.findRecordsByFilter('com_ledger_comercial', "audit_id ~ 'historical-'", 'id', 10, 0)
  if (oldRows.length !== 3) throw new Error('historical fixture count changed')
  for (var i = 0; i < oldRows.length; i++) {
    if (oldRows[i].getString('created')) throw new Error('historical rows must not be backfilled')
  }
  oldRows[0].set('audit_id', 'historical-updated-without-created')
  app.save(oldRows[0])
  var oldAfterUpdate = app.findRecordById('com_ledger_comercial', oldRows[0].id)
  if (oldAfterUpdate.getString('created'))
    throw new Error('updating a historical row must not attach it to the current flow')

  var fresh = new Record(ledger)
  fresh.id = 'new00000000000a'
  fresh.set('audit_id', 'post-cutoff')
  app.save(fresh)
  var created = fresh.getString('created')
  if (!created) throw new Error('new ledger row must receive created automatically')
  var posterior = created > cutoff.created || (created === cutoff.created && fresh.id > cutoff.id)
  if (!posterior) throw new Error('new ledger row must sort after immutable cutoff tuple')
  fresh.set('created', '2030-01-01 00:00:00.000Z')
  app.save(fresh)
  var freshAfterUpdate = app.findRecordById('com_ledger_comercial', fresh.id)
  if (freshAfterUpdate.getString('created') !== created)
    throw new Error('created must remain immutable after record updates')
}, function(_) {})
`

const ambiguousSetupMigration = `migrate(function(app) {
  var ledger = new Collection({ type: 'base', name: 'com_ledger_comercial', createRule: null, updateRule: null, deleteRule: null, listRule: null, viewRule: null })
  ledger.fields.add(new TextField({ name: 'audit_id', required: true, max: 160 }))
  ledger.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }))
  app.save(ledger)
  var dated = new Record(ledger)
  dated.id = 'dated0000000001'
  dated.set('audit_id', 'ambiguous-preexisting-created')
  app.save(dated)

  var cases = new Collection({ type: 'base', name: 'com_nexo_curadoria_casos', createRule: null, updateRule: null, deleteRule: null, listRule: null, viewRule: null })
  cases.fields.add(new TextField({ name: 'fingerprint', required: true, max: 160 }))
  app.save(cases)

  var parametros = new Collection({ type: 'base', name: 'com_parametros', createRule: null, updateRule: null, deleteRule: null, listRule: null, viewRule: null })
  parametros.fields.add(new TextField({ name: 'chave', required: true, max: 180 }))
  parametros.fields.add(new TextField({ name: 'valor', required: true, max: 10000 }))
  parametros.fields.add(new TextField({ name: 'descricao', required: false, max: 500 }))
  parametros.fields.add(new TextField({ name: 'tipo', required: true, max: 80 }))
  parametros.fields.add(new BoolField({ name: 'ativo', required: false }))
  parametros.fields.add(new NumberField({ name: 'versao', required: false, min: 0, onlyInt: true }))
  parametros.indexes = ['CREATE UNIQUE INDEX idx_com_parametros_chave ON com_parametros (chave)']
  app.save(parametros)
}, function(_) {})
`

const legacySetupMigration = `migrate(function(app) {
  var ledger = new Collection({ type: 'base', name: 'com_ledger_comercial', createRule: null, updateRule: null, deleteRule: null, listRule: null, viewRule: null })
  ledger.fields.add(new TextField({ name: 'audit_id', required: true, max: 160 }))
  app.save(ledger)
  var old = new Record(ledger)
  old.id = 'legacy000000001'
  old.set('audit_id', 'legacy-before-recovery')
  app.save(old)

  var cases = new Collection({ type: 'base', name: 'com_nexo_curadoria_casos', createRule: null, updateRule: null, deleteRule: null, listRule: null, viewRule: null })
  cases.fields.add(new TextField({ name: 'fingerprint', required: true, max: 160 }))
  app.save(cases)
  var oldCase = new Record(cases)
  oldCase.id = 'legacycase00001'
  oldCase.set('fingerprint', 'legacy-case-before-recovery')
  app.save(oldCase)

  var parametros = new Collection({ type: 'base', name: 'com_parametros', createRule: null, updateRule: null, deleteRule: null, listRule: null, viewRule: null })
  parametros.fields.add(new TextField({ name: 'chave', required: true, max: 180 }))
  parametros.fields.add(new TextField({ name: 'valor', required: true, max: 10000 }))
  parametros.fields.add(new TextField({ name: 'descricao', required: false, max: 500 }))
  parametros.fields.add(new TextField({ name: 'tipo', required: true, max: 80 }))
  parametros.fields.add(new BoolField({ name: 'ativo', required: false }))
  parametros.fields.add(new NumberField({ name: 'versao', required: false, min: 0, onlyInt: true }))
  app.save(parametros)
  var cutoffCreated = '2026-10-20 10:00:00.000Z'
  var cutoffId = '000000000000000'
  var policy = {
    policy_version: 'pmais_nexo_auto_promotion_policy_v1',
    cutoff: { created: cutoffCreated, id: cutoffId },
    automatic_schema_version: 'pmais_nexo_curadoria_conhecimento_automatico_v1',
    automatic_agent_id: 'nexo-curadoria-automatico',
    integrity_hash: String($security.sha256(['pmais_nexo_auto_promotion_policy_v1', cutoffCreated, cutoffId, 'pmais_nexo_curadoria_conhecimento_automatico_v1', 'nexo-curadoria-automatico'].join('|'))),
  }
  var parameter = new Record(parametros)
  parameter.set('chave', 'nexo.curadoria.fluxo_corrente_v1')
  parameter.set('valor', JSON.stringify(policy))
  parameter.set('tipo', 'json_imutavel')
  parameter.set('ativo', true)
  parameter.set('versao', 1)
  app.save(parameter)
}, function(_) {})
`

const legacyAssertionMigration = `migrate(function(app) {
  var ledger = app.findCollectionByNameOrId('com_ledger_comercial')
  var cases = app.findCollectionByNameOrId('com_nexo_curadoria_casos')
  if (!ledger.fields.getByName('created')) throw new Error('legacy ledger created not recovered')
  if (!cases.fields.getByName('created')) throw new Error('legacy cases created not recovered')
  if (app.findRecordById('com_ledger_comercial', 'legacy000000001').getString('created'))
    throw new Error('legacy ledger was backfilled')
  if (app.findRecordById('com_nexo_curadoria_casos', 'legacycase00001').getString('created'))
    throw new Error('legacy case was backfilled')
}, function(_) {})
`

fs.writeFileSync(path.join(migrationsDirectory, '202610291200_setup.js'), setupMigration)
for (const name of [originalMigration, recoveryMigration]) {
  fs.copyFileSync(
    path.join(root, 'pocketbase', 'migrations', name),
    path.join(migrationsDirectory, name),
  )
}
fs.writeFileSync(path.join(migrationsDirectory, '202610291800_assertions.js'), assertionMigration)
fs.writeFileSync(
  path.join(ambiguousMigrationsDirectory, '202610291200_setup.js'),
  ambiguousSetupMigration,
)
for (const name of [originalMigration, recoveryMigration]) {
  fs.copyFileSync(
    path.join(root, 'pocketbase', 'migrations', name),
    path.join(ambiguousMigrationsDirectory, name),
  )
}
fs.writeFileSync(
  path.join(legacyMigrationsDirectory, '202610291200_legacy_state.js'),
  legacySetupMigration,
)
fs.copyFileSync(
  path.join(root, 'pocketbase', 'migrations', recoveryMigration),
  path.join(legacyMigrationsDirectory, recoveryMigration),
)
fs.writeFileSync(
  path.join(legacyMigrationsDirectory, '202610291800_legacy_assertions.js'),
  legacyAssertionMigration,
)

function migrate(dataDir = dataDirectory, migrationsDir = migrationsDirectory) {
  return spawnSync(
    pocketbase,
    [
      'migrate',
      'up',
      '--dir',
      dataDir,
      '--migrationsDir',
      migrationsDir,
      '--hooksDir',
      hooksDirectory,
      '--dev=false',
    ],
    { cwd: root, encoding: 'utf8' },
  )
}

try {
  const first = migrate()
  const firstOutput = `${first.stdout || ''}${first.stderr || ''}`
  assert.strictEqual(first.status, 0, `PocketBase current-flow migration failed\n${firstOutput}`)
  assert.doesNotMatch(firstOutput, /failed to apply migration/i)

  const second = migrate()
  const secondOutput = `${second.stdout || ''}${second.stderr || ''}`
  assert.strictEqual(second.status, 0, `PocketBase idempotent replay failed\n${secondOutput}`)
  assert.doesNotMatch(secondOutput, /failed to apply migration/i)

  const ambiguous = migrate(ambiguousDataDirectory, ambiguousMigrationsDirectory)
  const ambiguousOutput = `${ambiguous.stdout || ''}${ambiguous.stderr || ''}`
  assert.match(ambiguousOutput, /ambiguous current-flow recovery with preexisting created field/)
  assert.match(ambiguousOutput, /failed to apply migration/i)
  assert.doesNotMatch(ambiguousOutput, /Applied 202610291300_nexo_curadoria_fluxo_corrente\.js/)

  const legacy = migrate(legacyDataDirectory, legacyMigrationsDirectory)
  const legacyOutput = `${legacy.stdout || ''}${legacy.stderr || ''}`
  assert.strictEqual(legacy.status, 0, `PocketBase legacy recovery failed\n${legacyOutput}`)
  assert.doesNotMatch(legacyOutput, /failed to apply migration/i)
  console.log(
    'PocketBase 0.36 Curadoria cutoff migration runtime: PASS old-ledger=3 old-case=1 blank-created new-ledger=1 new-case=1 after-cutoff policy=1 idempotent=true ambiguous-state=blocked legacy-policy-upgrade=recovered',
  )
} finally {
  fs.rmSync(workspace, { recursive: true, force: true })
}
