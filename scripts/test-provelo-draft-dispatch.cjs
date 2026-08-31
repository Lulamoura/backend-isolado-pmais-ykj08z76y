const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const relay = fs.readFileSync(path.join(root, 'pocketbase/hooks/ac_native_relay.js'), 'utf8')
const migration = fs.readFileSync(
  path.join(root, 'pocketbase/migrations/202608301900_provelo_integration_config.js'),
  'utf8',
)
const adminHook = fs.readFileSync(
  path.join(root, 'pocketbase/hooks/provelo_integration_admin.js'),
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
      relay.includes("indexOf('propostas qualificadas')") &&
      relay.includes("!== 'negociação'") &&
      relay.includes("'/api/3/dealGroups/'"),
  ],
  [
    'modalidade é obrigatória e ProveloID impede duplicação',
    relay.includes("customByLabel['Modalidade']") &&
      relay.includes("customByLabel['ProveloID']") &&
      relay.includes("recordProveloSkip(deal, 'PROVELO_ID_EXISTENTE')"),
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
      relay.includes("recordProveloSkip(deal, 'DISPATCH_JA_REGISTRADO')"),
  ],
  [
    'intenção pending é persistida antes do POST',
    dispatchBlock.indexOf("dispatch.set('status', 'pending')") <
      dispatchBlock.indexOf('$app.save(dispatch)'),
  ],
  [
    'timeout não produz retry cego',
    relay.includes('PROVELO_RESULTADO_INCERTO') &&
      relay.includes("dispatch.set('status', 'uncertain')") &&
      !relay.includes('PROVELO_RETRY'),
  ],
  [
    'HTTP 2xx sem confirmação explícita permanece incerto',
    relay.includes('responseJson.success !== true || !confirmedProveloId') &&
      relay.includes("result: 'ack_missing'") &&
      relay.includes('responseJson.ProveloID || responseJson.provelo_id || responseJson.id'),
  ],
  [
    'decisões sem tentativa são auditadas sem dados pessoais',
    relay.includes("event.set('evento_tipo', 'draft_skipped')") &&
      relay.includes("event.set('status', 'processed')") &&
      relay.includes('attempted: false') &&
      relay.includes("'provelo-skip|' + String(deal.id)") &&
      !/(contactEmail|ownerCode|webhookUrl|ValorServico)/.test(
        relay.slice(
          relay.indexOf('function recordProveloSkip'),
          relay.indexOf('function proveloDispatch'),
        ),
      ),
  ],
  [
    'runtime expõe marcador administrativo seguro no mesmo hook',
    relay.includes("'/backend/v1/integracao/ac/relay-v1/runtime-status'") &&
      relay.includes("contract_version: '2026-08-31-r3.3'") &&
      relay.includes('provelo_dispatcher: true') &&
      relay.includes("provelo_transport_version: 'zapier-json-fixed-width-v1'") &&
      relay.includes("$apis.requireAuth('users')"),
  ],
  [
    'logs persistidos não incluem email, vendedor, valor ou URL',
    !/(contactEmail|ownerCode|webhookUrl|ValorServico)/.test(dispatchBlock),
  ],
  [
    'hook administrativo não depende de declarações de topo no JSVM',
    !/^function\s+provelo/m.test(adminHook) &&
      adminHook.includes("findFirstRecordByData('com_integracao_provelo'") &&
      adminHook.includes("profile !== 'superadministrador'"),
  ],
  [
    'alteração administrativa é atômica e usa o schema canônico de auditoria',
    adminHook.includes('$app.runInTransaction(function (tx)') &&
      adminHook.includes("audit.set('acao', 'update')") &&
      adminHook.includes("audit.set('usuario_id', e.auth.id)") &&
      !adminHook.includes("audit.set('ator_id'"),
  ],
]

let passed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (ok) passed++
}
console.log(`\n${passed}/${checks.length} checks passed`)
if (passed !== checks.length) process.exit(1)
