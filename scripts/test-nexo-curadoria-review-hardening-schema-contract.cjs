const assert = require('assert')
const fs = require('fs')

const migrationPath = 'pocketbase/migrations/202610012300_nexo_curadoria_review_hardening.js'
assert(fs.existsSync(migrationPath), 'migração de hardening da revisão independente deve existir')
const failClosedMigrationPath = 'pocketbase/migrations/202610012330_nexo_curadoria_fail_closed.js'
assert(fs.existsSync(failClosedMigrationPath), 'nova migração fail-closed idempotente deve existir')

const failClosedMigration = fs.readFileSync(failClosedMigrationPath, 'utf8')
const migration = `${fs.readFileSync(migrationPath, 'utf8')}\n${failClosedMigration}`

for (const field of [
  'responsavel_id',
  'equipe_id',
  'negocio_id',
  'payload_hash',
  'next_attempt_at',
  'last_attempt_at',
  'tentativas_ciclo',
  'retry_count',
  'retry_requested_by',
  'retry_reason',
  'superseded_by',
  'claim_token',
  'claimed_at',
  'claim_expires_at',
  'command_hash',
]) {
  assert(migration.includes(`'${field}'`), `campo de hardening ausente: ${field}`)
}

assert.match(
  migration,
  /CREATE UNIQUE INDEX[^\n]+com_ledger_comercial[^\n]+audit_id/,
  'ledger deve impor idempotência atômica com índice unique em audit_id',
)
assert.match(
  migration,
  /CREATE INDEX[^\n]+com_nexo_curadoria_outbox[^\n]+caso_id[^\n]+caso_revisao/,
  'outbox deve indexar serialização por caso/revisão',
)
assert.match(
  migration,
  /name: 'com_nexo_curadoria_outbox_auditoria'/,
  'retry administrativo deve possuir auditoria protegida própria',
)
assert.match(
  migration,
  /CREATE UNIQUE INDEX[^\n]+outbox_id[^\n]+retry_count/,
  'cada retry administrativo deve ser auditado uma única vez',
)
assert.match(
  failClosedMigration,
  /com_nexo_curadoria_decisoes[\s\S]+createRule\s*=\s*null[\s\S]+updateRule\s*=\s*null[\s\S]+deleteRule\s*=\s*null/,
  'coleção legada de decisões deve ficar histórica e bloquear CRUD direto',
)
assert.match(
  failClosedMigration,
  /function addIfMissing[\s\S]+if \(!collection\.fields\.getByName\(name\)\)[\s\S]+collection\.fields\.add\(field\)/,
  'migração fail-closed deve adicionar campos de forma idempotente quando getByName retorna null',
)
assert.match(
  failClosedMigration,
  /idx_com_nexo_curadoria_outbox_claim/,
  'outbox deve indexar status e expiração do claim',
)

console.log('nexo-curadoria review hardening schema contract: PASS')
