const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const relay = fs.readFileSync(path.join(root, 'pocketbase/hooks/ac_native_relay.js'), 'utf8')
const migration = fs.readFileSync(
  path.join(root, 'pocketbase/migrations/202608301900_provelo_integration_config.js'),
  'utf8',
)
const dispatchBlock = relay.slice(
  relay.indexOf('var dispatch = new Record'),
  relay.indexOf('var body', relay.indexOf('var dispatch = new Record')),
)

const checks = [
  ['gate nasce desligado', migration.includes("record.set('habilitada', false)")],
  ['dispatcher exige gate explícito', relay.includes("!config || !config.getBool('habilitada')")],
  [
    'pipeline e etapa seguem o Zap publicado',
    relay.includes("indexOf('proposta qualificada')") &&
      relay.includes("!== 'negociação'") &&
      relay.includes("'/api/3/dealGroups/'"),
  ],
  [
    'modalidade é obrigatória e ProveloID impede duplicação',
    relay.includes("customByLabel['Modalidade']") &&
      relay.includes("customByLabel['ProveloID']") &&
      relay.includes("reason: 'PROVELO_ID_EXISTENTE'"),
  ],
  [
    'contrato replica cinco campos do Zapier',
    ['DealId', 'Modalidade', 'Email', 'Vendedor', 'ValorServico'].every((field) =>
      relay.includes(`${field}:`),
    ),
  ],
  [
    'valor usa apresentação brasileira',
    relay.includes("groups.join('.') + ',' + decimal") && relay.includes('deal.value'),
  ],
  [
    'destino vem da configuração protegida e restringe host Make',
    relay.includes("config.getString('endpoint')") && relay.includes('hook\\.us1\\.make\\.com'),
  ],
  [
    'dispatch usa idempotência estável por negócio',
    relay.includes("$security.sha256('provelo-draft|' + String(deal.id))") &&
      relay.includes("'idempotency_key'") &&
      relay.includes("reason: 'DISPATCH_JA_REGISTRADO'"),
  ],
  [
    'intenção pending é persistida antes do POST',
    dispatchBlock.indexOf("dispatch.set('status', 'pending')") <
      dispatchBlock.indexOf('$app.save(dispatch)'),
  ],
  [
    'timeout não produz retry cego',
    relay.includes('PROVELO_RESULTADO_INCERTO') && !relay.includes('PROVELO_RETRY'),
  ],
  [
    'logs persistidos não incluem email, vendedor, valor ou URL',
    !/(contactEmail|ownerCode|webhookUrl|ValorServico)/.test(dispatchBlock),
  ],
]

let passed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (ok) passed++
}
console.log(`\n${passed}/${checks.length} checks passed`)
if (passed !== checks.length) process.exit(1)
