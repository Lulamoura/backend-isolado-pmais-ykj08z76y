const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const pocketbase = process.env.POCKETBASE_BIN
assert(pocketbase, 'POCKETBASE_BIN must point to a PocketBase 0.36.x binary')
assert(fs.existsSync(pocketbase), `PocketBase binary not found: ${pocketbase}`)

const migrationNames = [
  '202611191300_nexo_curadoria_n7_execution_metrics.js',
  '202611191310_nexo_curadoria_n7_worker_state.js',
  '202611191320_nexo_curadoria_n7_controls.js',
  '202611191330_nexo_curadoria_n7_worker_state_zero.js',
]
for (const name of migrationNames)
  assert(fs.existsSync(path.join(root, 'pocketbase', 'migrations', name)), `missing ${name}`)

const workspace = fs.mkdtempSync(
  path.join(process.env.TMPDIR || os.tmpdir(), 'nexo-curadoria-n7-pb036-'),
)
const dataDirectory = path.join(workspace, 'data')
const migrationsDirectory = path.join(workspace, 'migrations')
const hooksDirectory = path.join(workspace, 'empty-hooks')
fs.mkdirSync(migrationsDirectory, { recursive: true })
fs.mkdirSync(hooksDirectory, { recursive: true })

const setupMigration = `migrate(function(app) {
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

const assertionMigration = `migrate(function(app) {
  function requireField(collection, name, type) {
    var field = collection.fields.getByName(name)
    if (!field || field.type() !== type) throw new Error(collection.name + '.' + name + ' invalid')
    return field
  }
  function requirePrivate(collection) {
    var names = ['createRule', 'updateRule', 'deleteRule', 'listRule', 'viewRule']
    for (var i = 0; i < names.length; i++)
      if (collection[names[i]] !== null) throw new Error(collection.name + '.' + names[i] + ' must be private')
  }

  var cases = app.findCollectionByNameOrId('com_nexo_curadoria_casos')
  var origin = requireField(cases, 'origin_worker_identity', 'text')
  if (origin.required || origin.max !== 80) throw new Error('origin_worker_identity contract invalid')

  var executions = app.findCollectionByNameOrId('com_nexo_curadoria_execucoes')
  requirePrivate(executions)
  requireField(executions, 'worker_identity', 'text')
  requireField(executions, 'outbox_processed', 'number')
  requireField(executions, 'outbox_failed', 'number')
  requireField(executions, 'outbox_invalidated', 'number')

  var workerState = app.findCollectionByNameOrId('com_nexo_curadoria_worker_estado')
  requirePrivate(workerState)
  requireField(workerState, 'worker_identity', 'text')
  requireField(workerState, 'gate_version', 'text')
  requireField(workerState, 'cursor_created', 'text')
  requireField(workerState, 'cursor_id', 'text')
  requireField(workerState, 'pending_ledger_ids', 'json')
  requireField(workerState, 'pending_ledger_hashes', 'json')
  requireField(workerState, 'lease_owner', 'text')
  requireField(workerState, 'lease_expires_at', 'date')
  var processedRecords = requireField(workerState, 'processed_records', 'number')
  if (processedRecords.required || Number(processedRecords.min) !== 0 || !processedRecords.onlyInt)
    throw new Error('processed_records must accept the initial zero value')
  var states = app.findRecordsByFilter('com_nexo_curadoria_worker_estado', "worker_identity = 'nexo-curadoria-n7'", '', 2, 0)
  if (states.length !== 0) throw new Error('worker state must not be fabricated before the first governed run')
  var zeroState = new Record(workerState)
  zeroState.set('worker_identity', 'nexo-curadoria-n7-zero-test')
  zeroState.set('gate_version', 'test')
  zeroState.set('cursor_created', '2026-11-19 10:10:58.360Z')
  zeroState.set('cursor_id', '8k78ljeajfeuwxn')
  zeroState.set('processed_records', 0)
  zeroState.set('last_result_code', 'test')
  zeroState.set('last_executed_at', new Date())
  app.save(zeroState)
  if (zeroState.getInt('processed_records') !== 0)
    throw new Error('processed_records did not persist the initial zero value')
  app.delete(zeroState)

  var keys = ['nexo.curadoria.operacao_n7_switch_v1', 'nexo.curadoria.outbox_n7_switch_v1']
  for (var j = 0; j < keys.length; j++) {
    var rows = app.findRecordsByFilter('com_parametros', "chave = '" + keys[j] + "'", '', 2, 0)
    if (rows.length !== 1) throw new Error('switch cardinality invalid: ' + keys[j])
    if (!rows[0].getBool('ativo') || rows[0].getString('tipo') !== 'booleano' || rows[0].getString('valor') !== 'false' || rows[0].getInt('versao') !== 1)
      throw new Error('switch must start fail-closed: ' + keys[j])
  }
}, function(_) {})
`

fs.writeFileSync(path.join(migrationsDirectory, '202611191200_setup.js'), setupMigration)
for (const name of migrationNames) {
  const source = path.join(root, 'pocketbase', 'migrations', name)
  fs.copyFileSync(source, path.join(migrationsDirectory, name))
}
// Reapply the same migration bodies under later versions to prove idempotent compatibility.
for (let index = 0; index < migrationNames.length; index += 1) {
  const source = path.join(root, 'pocketbase', 'migrations', migrationNames[index])
  fs.copyFileSync(
    source,
    path.join(migrationsDirectory, `2026111914${index}0_n7_idempotent_replay.js`),
  )
}
fs.writeFileSync(path.join(migrationsDirectory, '202611191500_assertions.js'), assertionMigration)

try {
  const result = spawnSync(
    pocketbase,
    [
      'migrate',
      'up',
      '--dir',
      dataDirectory,
      '--migrationsDir',
      migrationsDirectory,
      '--hooksDir',
      hooksDirectory,
      '--dev=false',
    ],
    { cwd: root, encoding: 'utf8' },
  )
  const output = `${result.stdout || ''}${result.stderr || ''}`
  assert.strictEqual(result.status, 0, `PocketBase N7 migration failed\n${output}`)
  assert.doesNotMatch(output, /failed to apply migration/i)
  console.log(
    'PocketBase 0.36 Curadoria N7 migrations: PASS metrics=private state=empty-ready controls=disabled case-origin=materialized idempotent=true',
  )
} finally {
  fs.rmSync(workspace, { recursive: true, force: true })
}
