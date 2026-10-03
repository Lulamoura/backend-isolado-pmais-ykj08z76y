const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const pocketbase = process.env.POCKETBASE_BIN
assert(pocketbase, 'POCKETBASE_BIN must point to a PocketBase 0.36.x binary')
assert(fs.existsSync(pocketbase), `PocketBase binary not found: ${pocketbase}`)

const sourceMigrations = [
  '202610012100_nexo_aprendizado_whatsapp_proveniencia.js',
  '202610012110_nexo_curadoria_decisoes_acl_fail_closed.js',
  '202610012220_nexo_curadoria_comercial_unificada.js',
  '202610012300_nexo_curadoria_review_hardening.js',
  '202610012330_nexo_curadoria_fail_closed.js',
  '202610012340_nexo_curadoria_schema_recovery.js',
  '202610012350_nexo_curadoria_outbox_zero_attempt.js',
]

function assertIsolatedAclMigrationSource() {
  const source = fs.readFileSync(
    path.join(root, 'pocketbase', 'migrations', sourceMigrations[1]),
    'utf8',
  )
  const expected = `migrate(
  function (app) {
    var decisoes = app.findCollectionByNameOrId('com_nexo_curadoria_decisoes')
    decisoes.createRule = null
    decisoes.updateRule = null
    decisoes.deleteRule = null
    app.save(decisoes)
  },
  function (_) {},
)
`
  assert.strictEqual(
    source.replace(/\s+/g, ' ').trim(),
    expected.replace(/\s+/g, ' ').trim(),
    'isolated ACL migration must only close decision mutation rules and save the collection',
  )
  assert.doesNotMatch(
    source,
    /\b(?:Record|Field|countRecords|findRecord|findRecords)\b|app\.delete\s*\(/,
    'isolated ACL migration must not read, write, or delete records, fields, or indexes',
  )
}

const workspace = fs.mkdtempSync(
  path.join(process.env.TMPDIR || os.tmpdir(), 'nexo-curadoria-pb036-'),
)

function writeMigration(directory, name, content) {
  fs.mkdirSync(directory, { recursive: true })
  fs.writeFileSync(path.join(directory, name), content)
}

function copyMigration(directory, name) {
  fs.mkdirSync(directory, { recursive: true })
  fs.copyFileSync(path.join(root, 'pocketbase', 'migrations', name), path.join(directory, name))
}

function runMigrate(label, dataDirectory, migrationsDirectory, action, expectedFailure) {
  const hooksDirectory = path.join(workspace, 'empty-hooks')
  fs.mkdirSync(hooksDirectory, { recursive: true })
  const result = spawnSync(
    pocketbase,
    [
      'migrate',
      ...action,
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
  if (expectedFailure) {
    assert.match(output, expectedFailure, `${label} failed without the expected diagnostic`)
  } else {
    assert.strictEqual(result.status, 0, `${label} failed\n${output}`)
    assert.doesNotMatch(
      output,
      /failed to apply migration/i,
      `${label} reported a migration failure`,
    )
  }
  return output
}

const baseSetup = `migrate(
  function (app) {
    var eventos = new Collection({ type: 'base', name: 'com_nexo_aprendizado_eventos', createRule: null, updateRule: null, deleteRule: null, listRule: null, viewRule: null })
    eventos.fields.add(new TextField({ name: 'legacy_marker', required: false, max: 80 }))
    app.save(eventos)

    var ledger = new Collection({ type: 'base', name: 'com_ledger_comercial', createRule: null, updateRule: null, deleteRule: null, listRule: null, viewRule: null })
    ledger.fields.add(new TextField({ name: 'audit_id', required: true, max: 160 }))
    ledger.fields.add(new TextField({ name: 'legacy_marker', required: false, max: 80 }))
    ledger.indexes = ['CREATE INDEX idx_com_ledger_comercial_audit ON com_ledger_comercial (audit_id)']
    app.save(ledger)

    var decisoes = new Collection({ type: 'base', name: 'com_nexo_curadoria_decisoes', createRule: "@request.auth.id != ''", updateRule: "@request.auth.id != ''", deleteRule: null, listRule: "@request.auth.id != ''", viewRule: "@request.auth.id != ''" })
    decisoes.fields.add(new TextField({ name: 'legacy_marker', required: false, max: 80 }))
    app.save(decisoes)
  },
  function (_) {},
)
`

const seedFreshRecords = `migrate(
  function (app) {
    function save(name, values) {
      var record = new Record(app.findCollectionByNameOrId(name))
      for (var key in values) record.set(key, values[key])
      app.save(record)
    }

    save('com_nexo_aprendizado_eventos', { legacy_marker: 'keep-evento' })
    save('com_ledger_comercial', { audit_id: 'audit-fresh-1', legacy_marker: 'keep-ledger' })
    save('com_nexo_curadoria_decisoes', { legacy_marker: 'keep-decisao' })
    save('com_nexo_curadoria_casos', {
      fingerprint: 'fingerprint-1', revisao: 1, status: 'novo', fonte_principal: 'whatsapp',
      escopo_tipo: 'negocio', assunto_chave: 'assunto', recorrencia_chave: 'recorrencia',
      titulo: 'Caso', resumo_factual: 'Resumo', motivo_curadoria: 'Motivo', evidencia_contagem: 1,
      casos_independentes: 1, recorrencia_contagem: 1, risco_classe: 'baixo', alcada: 'gestor',
      confianca: 'alta', first_seen_at: '2026-10-01 12:00:00.000Z', last_seen_at: '2026-10-01 12:00:00.000Z'
    })
    save('com_nexo_curadoria_evidencias', {
      caso_id: 'caso-1', fonte_tipo: 'whatsapp', evidencia_hash: 'evidencia-1',
      resumo_factual: 'Evidencia', occurred_at: '2026-10-01 12:00:00.000Z'
    })
    save('com_nexo_curadoria_transicoes', {
      caso_id: 'caso-1', transicao_chave: 'transicao-1', status_novo: 'novo', motivo: 'Criado',
      ocorreu_em: '2026-10-01 12:00:00.000Z'
    })
    save('com_nexo_curadoria_outbox', {
      caso_id: 'caso-1', acao: 'publicar', idempotency_key: 'outbox-1', status: 'pendente',
      tentativas: 1, payload_hash: 'payload-1', payload_json: { ok: true }, caso_revisao: 1,
      requested_at: '2026-10-01 12:00:00.000Z'
    })
  },
  function (_) {},
)
`

const seedAuditRecord = `migrate(
  function (app) {
    var collection = app.findCollectionByNameOrId('com_nexo_curadoria_outbox_auditoria')
    var record = new Record(collection)
    record.set('outbox_id', 'outbox-1')
    record.set('retry_count', 1)
    record.set('ator_id', 'ator-1')
    record.set('motivo', 'Retentativa')
    record.set('status_anterior', 'erro')
    record.set('requested_at', '2026-10-01 12:00:00.000Z')
    app.save(record)
  },
  function (_) {},
)
`

function verificationMigration(label, expectedCuradoriaCount) {
  return `migrate(
  function (app) {
    function assert(condition, message) { if (!condition) throw new Error(message) }
    var privateNames = ['com_nexo_curadoria_casos', 'com_nexo_curadoria_evidencias', 'com_nexo_curadoria_transicoes', 'com_nexo_curadoria_outbox', 'com_nexo_curadoria_outbox_auditoria']
    for (var i = 0; i < privateNames.length; i++) {
      var collection = app.findCollectionByNameOrId(privateNames[i])
      assert(collection.createRule === null && collection.updateRule === null && collection.deleteRule === null && collection.listRule === null && collection.viewRule === null, privateNames[i] + ' is not private')
      assert(app.countRecords(privateNames[i]) === ${expectedCuradoriaCount}, privateNames[i] + ' record count changed')
    }
    var decisions = app.findCollectionByNameOrId('com_nexo_curadoria_decisoes')
    assert(decisions.createRule === null && decisions.updateRule === null && decisions.deleteRule === null, 'decisions mutation rules are not closed')
    assert(app.findCollectionByNameOrId('com_nexo_curadoria_casos').fields.getByName('fingerprint').type() === 'text', 'PocketBase field type() mismatch')
    var tentativas = app.findCollectionByNameOrId('com_nexo_curadoria_outbox').fields.getByName('tentativas')
    assert(tentativas.type() === 'number', 'outbox tentativas type changed')
    assert(String(tentativas.min) === String(new NumberField({ name: 'tentativas', min: 0 }).min), 'outbox tentativas min changed')
    assert(tentativas.required === false, 'outbox tentativas must accept the initial zero value')
    assert(app.countRecords('com_nexo_aprendizado_eventos') === 1, 'event record count changed')
    assert(app.countRecords('com_ledger_comercial') === 1, 'ledger record count changed')
    assert(app.countRecords('com_nexo_curadoria_decisoes') === 1, 'decision record count changed')
    console.log('${label}: PASS')
  },
  function (_) {},
)
`
}

function runFreshChain() {
  const migrations = path.join(workspace, 'fresh-migrations')
  const data = path.join(workspace, 'fresh-data')
  writeMigration(migrations, '202610012000_setup_base.js', baseSetup)
  copyMigration(migrations, sourceMigrations[0])
  copyMigration(migrations, sourceMigrations[1])
  copyMigration(migrations, sourceMigrations[2])
  writeMigration(migrations, '202610012250_seed_records.js', seedFreshRecords)
  copyMigration(migrations, sourceMigrations[3])
  writeMigration(migrations, '202610012310_seed_audit_record.js', seedAuditRecord)
  copyMigration(migrations, sourceMigrations[4])
  copyMigration(migrations, sourceMigrations[5])
  copyMigration(migrations, sourceMigrations[6])
  writeMigration(migrations, '202610012360_verify.js', verificationMigration('fresh chain', 1))

  runMigrate('fresh chain', data, migrations, ['up'])
  runMigrate('fresh recovery down', data, migrations, ['down', '2'])
  runMigrate('fresh recovery rerun', data, migrations, ['up'])
  runMigrate('all non-destructive downs', data, migrations, ['down', '10'])

  const verifyOnly = path.join(workspace, 'fresh-verify-after-down')
  writeMigration(
    verifyOnly,
    '202610012999_verify_after_down.js',
    verificationMigration('fresh chain after down', 1),
  )
  runMigrate('fresh state after all downs', data, verifyOnly, ['up'])
}

const liveSetup = `migrate(
  function (app) {
    var eventos = new Collection({ type: 'base', name: 'com_nexo_aprendizado_eventos', createRule: null, updateRule: null, deleteRule: null, listRule: null, viewRule: null })
    eventos.fields.add(new TextField({ name: 'legacy_marker', required: false, max: 80 }))
    app.save(eventos)
    var evento = new Record(eventos); evento.set('legacy_marker', 'keep-evento'); app.save(evento)

    var ledger = new Collection({ type: 'base', name: 'com_ledger_comercial', createRule: null, updateRule: null, deleteRule: null, listRule: null, viewRule: null })
    ledger.fields.add(new TextField({ name: 'audit_id', required: true, max: 160 }))
    ledger.fields.add(new TextField({ name: 'legacy_marker', required: false, max: 80 }))
    ledger.indexes = ['CREATE INDEX idx_com_ledger_comercial_audit ON com_ledger_comercial (audit_id)']
    app.save(ledger)
    var ledgerRecord = new Record(ledger); ledgerRecord.set('audit_id', 'audit-live-1'); ledgerRecord.set('legacy_marker', 'keep-ledger'); app.save(ledgerRecord)

    var decisoes = new Collection({ type: 'base', name: 'com_nexo_curadoria_decisoes', createRule: "@request.auth.id != ''", updateRule: "@request.auth.id != ''", deleteRule: null, listRule: "@request.auth.id != ''", viewRule: "@request.auth.id != ''" })
    decisoes.fields.add(new TextField({ name: 'legacy_marker', required: false, max: 80 }))
    app.save(decisoes)
    var decisao = new Record(decisoes); decisao.set('legacy_marker', 'keep-decisao'); app.save(decisao)
  },
  function (_) {},
)
`

function runLiveRecovery() {
  const migrations = path.join(workspace, 'live-migrations')
  const data = path.join(workspace, 'live-data')
  writeMigration(migrations, '202610012105_setup_live.js', liveSetup)
  runMigrate('live setup', data, migrations, ['up'])
  copyMigration(migrations, sourceMigrations[1])
  copyMigration(migrations, sourceMigrations[5])
  copyMigration(migrations, sourceMigrations[6])
  writeMigration(migrations, '202610012360_verify.js', verificationMigration('live recovery', 0))

  runMigrate('known live partial recovery', data, migrations, ['up'])
  runMigrate('live recovery down', data, migrations, ['down', '2'])
  runMigrate('live recovery rerun', data, migrations, ['up'])
  runMigrate('all live downs', data, migrations, ['down', '4'])

  const verifyOnly = path.join(workspace, 'live-verify-after-down')
  writeMigration(
    verifyOnly,
    '202610012999_verify_after_down.js',
    verificationMigration('live recovery after down', 0),
  )
  runMigrate('live state after all downs', data, verifyOnly, ['up'])
}

const populatedPartialSetup = `migrate(
  function (app) {
    var eventos = new Collection({ type: 'base', name: 'com_nexo_aprendizado_eventos' }); app.save(eventos)
    var ledger = new Collection({ type: 'base', name: 'com_ledger_comercial' }); ledger.fields.add(new TextField({ name: 'audit_id', required: true, max: 160 })); app.save(ledger)
    var decisoes = new Collection({ type: 'base', name: 'com_nexo_curadoria_decisoes', createRule: "@request.auth.id != ''", updateRule: "@request.auth.id != ''", deleteRule: "@request.auth.id != ''" }); app.save(decisoes)
    app.save(new Record(decisoes))
    var casos = new Collection({ type: 'base', name: 'com_nexo_curadoria_casos', createRule: "@request.auth.id != ''", updateRule: "@request.auth.id != ''" })
    casos.fields.add(new TextField({ name: 'fingerprint', required: true, max: 160 })); app.save(casos)
    var record = new Record(casos); record.set('fingerprint', 'existing-partial'); app.save(record)
  },
  function (_) {},
)
`

const populatedPartialVerify = `migrate(
  function (app) {
    function assert(condition, message) { if (!condition) throw new Error(message) }
    var casos = app.findCollectionByNameOrId('com_nexo_curadoria_casos')
    assert(app.countRecords(casos) === 1, 'partial collection record count changed')
    assert(casos.fields.getByName('fingerprint').type() === 'text', 'existing field changed')
    assert(casos.fields.getByName('revisao') === null, 'partial schema was altered before refusal')
    assert(String(casos.createRule) === "@request.auth.id != ''", 'partial collection ACL changed before refusal')
    var decisoes = app.findCollectionByNameOrId('com_nexo_curadoria_decisoes')
    assert(decisoes.createRule === null && decisoes.updateRule === null && decisoes.deleteRule === null, 'decisions mutation ACLs did not remain fail-closed after later recovery failure: ' + String(decisoes.createRule) + ' / ' + String(decisoes.updateRule) + ' / ' + String(decisoes.deleteRule))
    assert(app.countRecords(decisoes) === 1, 'decision record count changed')
    console.log('populated partial preflight: PASS')
  },
  function (_) {},
)
`

function runPopulatedPartialPreflight() {
  const migrations = path.join(workspace, 'partial-migrations')
  const data = path.join(workspace, 'partial-data')
  writeMigration(migrations, '202610012105_setup_partial.js', populatedPartialSetup)
  runMigrate('populated partial setup', data, migrations, ['up'])
  copyMigration(migrations, sourceMigrations[1])
  runMigrate('populated partial ACL hardening', data, migrations, ['up'])
  copyMigration(migrations, sourceMigrations[5])
  runMigrate(
    'populated partial preflight',
    data,
    migrations,
    ['up'],
    /populated partial Curadoria collection com_nexo_curadoria_casos/i,
  )

  const verifyOnly = path.join(workspace, 'partial-verify')
  writeMigration(verifyOnly, '202610012350_verify_partial.js', populatedPartialVerify)
  runMigrate('populated partial state preservation', data, verifyOnly, ['up'])
}

function runMissingDecisionsFailClosed() {
  const migrations = path.join(workspace, 'missing-decisions-migrations')
  const data = path.join(workspace, 'missing-decisions-data')
  copyMigration(migrations, sourceMigrations[1])
  runMigrate(
    'missing decisions collection',
    data,
    migrations,
    ['up'],
    /failed to apply migration .*decisoes_acl_fail_closed[^\n]*(?:no rows|not found)/i,
  )
}

try {
  assertIsolatedAclMigrationSource()
  runFreshChain()
  runLiveRecovery()
  runPopulatedPartialPreflight()
  runMissingDecisionsFailClosed()
  console.log('PocketBase 0.36 Curadoria integration: PASS')
} finally {
  fs.rmSync(workspace, { recursive: true, force: true })
}
