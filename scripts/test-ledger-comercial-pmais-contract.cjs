const fs = require('node:fs')
const assert = require('node:assert/strict')

const migrationPath = 'pocketbase/migrations/202609261715_ledger_comercial_pmais.js'
const uazapiHookPath = 'pocketbase/hooks/com_whatsapp_uazapi_webhook.js'
const nexoHookPath = 'pocketbase/hooks/com_propostas_operacao.js'
const packagePath = 'package.json'

assert.ok(fs.existsSync(migrationPath), 'deve existir migração do Ledger Comercial PMais')

const migration = fs.readFileSync(migrationPath, 'utf8')
const uazapiHook = fs.readFileSync(uazapiHookPath, 'utf8')
const nexoHook = fs.readFileSync(nexoHookPath, 'utf8')
const pkg = fs.readFileSync(packagePath, 'utf8')

assert.match(migration, /com_ledger_comercial/, 'migração deve criar coleção com_ledger_comercial')
assert.match(migration, /createRule:\s*null/, 'ledger não deve aceitar criação direta pelo cliente')
assert.match(
  migration,
  /updateRule:\s*null/,
  'ledger não deve aceitar atualização direta pelo cliente',
)
assert.match(
  migration,
  /deleteRule:\s*null/,
  'ledger não deve aceitar exclusão direta pelo cliente',
)

for (const field of [
  'fonte',
  'canal',
  'origem',
  'tipo_evento',
  'fato',
  'evidencia_ref',
  'destino_sugerido',
  'risco',
  'retencao',
  'status',
  'confianca',
  'promocao_modo',
  'revisao_status',
  'audit_id',
  'occurred_at',
]) {
  assert.match(migration, new RegExp(`name: '${field}'`), `ledger deve ter campo ${field}`)
}

assert.match(
  migration,
  /promovido_baixo_risco|ativo_provisorio|escalar_direcao/,
  'migração deve documentar estados de promoção governada',
)
assert.match(
  migration,
  /idx_com_ledger_comercial_audit/,
  'ledger deve ter índice por audit_id para rastreabilidade',
)
assert.match(
  migration,
  /idx_com_ledger_comercial_destino/,
  'ledger deve ter índice por destino/status para filas administrativas',
)

assert.match(
  uazapiHook,
  /function\s+criarLedgerComercial/,
  'hook Uazapi deve ter função dedicada para criar ledger comercial',
)
assert.match(
  uazapiHook,
  /com_ledger_comercial/,
  'hook Uazapi deve persistir fatos no Ledger Comercial PMais',
)
assert.match(
  uazapiHook,
  /promover_baixo_risco|ativo_provisorio|escalar_direcao/,
  'hook Uazapi deve conhecer destinos de promoção governada',
)
assert.match(
  uazapiHook,
  /tokens?|segredos?|payload bruto/i,
  'hook Uazapi deve preservar regra de não mandar segredos/payload bruto para o ledger',
)

assert.match(
  uazapiHook,
  /function\s+garantirColecaoLedgerComercial/,
  'hook Uazapi deve criar/reparar a coleção do ledger quando a migration ainda não materializou no Preview',
)
assert.match(
  nexoHook,
  /function\s+nexoGarantirColecaoLedgerComercial/,
  'hook Nexo/App Comercial deve criar/reparar a coleção do ledger quando a migration ainda não materializou no Preview',
)

assert.match(
  nexoHook,
  /com_ledger_comercial|criarLedgerComercial|nexo.*ledger/i,
  'eventos do App Comercial/Nexo também devem alimentar o Ledger Comercial',
)
const ledgerWrites = [
  ...(nexoHook + uazapiHook).matchAll(/(?:ledger|record)\.set\('([^']+)'/g),
].map((m) => m[1])
for (const forbidden of [
  'authorization',
  'bearer',
  'password',
  'senha',
  'secret',
  'api_key',
  'apikey',
  'token',
]) {
  assert.ok(
    !ledgerWrites.some((field) => field.toLowerCase().includes(forbidden)),
    `ledger não pode persistir campo sensível: ${forbidden}`,
  )
}

assert.match(
  pkg,
  /test-ledger-comercial-pmais-contract\.cjs/,
  'npm test deve executar o contrato do Ledger Comercial PMais',
)

console.log('ledger-comercial-pmais contract: PASS')
