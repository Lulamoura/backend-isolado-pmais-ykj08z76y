const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const contract = fs.readFileSync(path.join(root, 'docs/t6-ac-integration-contract.md'), 'utf8')
const webhook = fs.readFileSync(path.join(root, 'pocketbase/hooks/ac_webhook.js'), 'utf8')
const entry = fs.readFileSync(path.join(root, 'pocketbase/hooks/com_entrada_negocio.js'), 'utf8')
const negociosUi = fs.readFileSync(
  path.join(root, 'src/components/foundation/NegociosTab.tsx'),
  'utf8',
)
const reconciliationHook = fs.readFileSync(
  path.join(root, 'pocketbase/hooks/com_ac_reconciliacao.js'),
  'utf8',
)
const reconciliationService = fs.readFileSync(
  path.join(root, 'src/services/ac-reconciliation.ts'),
  'utf8',
)
const reconciliationUi = fs.readFileSync(
  path.join(root, 'src/components/foundation/ActiveCampaignReconciliationCard.tsx'),
  'utf8',
)
const migration = fs.readFileSync(
  path.join(root, 'pocketbase/migrations/0002_t6_ac8r_integration_controls.js'),
  'utf8',
)
const synthetic = fs.readFileSync(path.join(root, 'pocketbase/hooks/ac_synthetic_v1.js'), 'utf8')
const preoperationGuard = fs.readFileSync(
  path.join(root, 'pocketbase/hooks/com_preoperacao_guard.js'),
  'utf8',
)
const mutationHooks = [
  'com_qualificacao.js',
  'com_atividades_operacao.js',
  'com_fechamentos_operacao.js',
  'com_ordens_execucao.js',
].map((name) => fs.readFileSync(path.join(root, 'pocketbase/hooks', name), 'utf8'))

const checks = [
  ['contrato define event_id', contract.includes('"event_id"')],
  ['contrato define source_version', contract.includes('"source_version"')],
  ['contrato define replay canônico', contract.includes('replay=true')],
  ['contrato define evento obsoleto', contract.includes('stale=true')],
  ['contrato define atomicidade', contract.includes('Cada evento é uma única transação')],
  ['contrato define dry-run/fingerprint', contract.includes('fingerprint do plano')],
  ['contrato define lock/cursor', contract.includes('lock global') && contract.includes('cursor')],
  ['contrato define Vendedor 3 sem inferência', contract.includes('Vendedor 3')],
  ['entrada manual recusa não-superadmin', entry.includes('ENTRADA_MANUAL_BLOQUEADA')],
  [
    'contingência exige justificativa e confirmação literal',
    entry.includes('CONTINGENCIA_NAO_CONFIRMADA') && entry.includes('CRIAR FORA DO ACTIVECAMPAIGN'),
  ],
  [
    'interface oculta entrada operacional',
    negociosUi.includes('isSuperAdmin && !loadingSuperAdmin') &&
      negociosUi.includes('Adicionar em contingência'),
  ],
  [
    'webhook V1 continua desligado por parâmetro',
    webhook.includes("paramTrue('ac_webhook_enabled')") &&
      migration.includes("['ac_webhook_enabled', 'false'") &&
      webhook.includes("$security.sha256('activecampaign|' + event.event_id)"),
  ],
  [
    'webhook V1 trata replay, obsolescência, conflito e transação',
    webhook.includes('replay: true') &&
      webhook.includes('stale: true') &&
      webhook.includes('VERSAO_CONFLITANTE') &&
      webhook.includes('$app.runInTransaction'),
  ],
  [
    'parâmetros de integração nascem inertes',
    migration.includes("['ac_reconciliation_enabled', 'false'") &&
      migration.includes("['ac_synthetic_preview_enabled', 'false'") &&
      migration.includes("'ac_preoperation_read_only'") &&
      migration.includes("'true'"),
  ],
  [
    'canal sintético é restrito e atravessa webhook assinado',
    synthetic.includes("slug !== 'superadministrador'") &&
      synthetic.includes("indexOf('test:')") &&
      synthetic.includes("indexOf('[TESTE]')") &&
      synthetic.includes("'/backend/v1/integracao/ac/webhook'") &&
      synthetic.includes('$security.hs256(serialized, secret)'),
  ],
  [
    'reconciliação é inerte por padrão e restrita ao SuperAdmin',
    reconciliationHook.includes('ac_reconciliation_enabled') &&
      reconciliationHook.includes("slug !== 'superadministrador'"),
  ],
  [
    'consulta ActiveCampaign somente no backend',
    reconciliationHook.includes("$secrets.get('AC_API_KEY')") &&
      reconciliationHook.includes("'Api-Token': apiKey") &&
      !reconciliationService.includes('AC_API_KEY') &&
      !reconciliationUi.includes('Api-Token'),
  ],
  [
    'endpoints implementam Simular e Executar',
    reconciliationHook.includes('/reconciliacao/simular') &&
      reconciliationHook.includes('/reconciliacao/executar') &&
      reconciliationService.includes("confirmation: 'RECONCILIAR ACTIVECAMPAIGN'"),
  ],
  [
    'execução usa fingerprint, validade, lock e idempotência',
    reconciliationHook.includes('FINGERPRINT_OBSOLETO') &&
      reconciliationHook.includes('RECONCILIACAO_EM_ANDAMENTO') &&
      reconciliationHook.includes('reconcile-command|'),
  ],
  [
    'execução refaz leitura antes da transação',
    reconciliationHook.includes('revalidation_of') &&
      reconciliationHook.includes('recheck.json.fingerprint !== body.fingerprint'),
  ],
  [
    'execução comercial e cursor usam transação única',
    reconciliationHook.includes('$app.runInTransaction') &&
      reconciliationHook.includes('ac_reconciliation_cursor') &&
      reconciliationHook.includes('EXECUCAO_REVERTIDA'),
  ],
  [
    'interface exige simulação anterior',
    reconciliationUi.includes('Simular') &&
      reconciliationUi.includes('Executar plano simulado') &&
      reconciliationUi.includes('!simulation?.can_execute'),
  ],
  [
    'pré-carga filtra aberto + Negociação e usa Responsável comercial',
    reconciliationHook.includes("requestedMode === 'initial_open_negotiation'") &&
      reconciliationHook.includes("String(deals[di].status) === '0'") &&
      reconciliationHook.includes("toLowerCase() === 'negociação'") &&
      reconciliationHook.includes("customFields['Responsável']"),
  ],
  [
    'pré-operação bloqueia comandos mutantes sobre importados reais',
    mutationHooks.every(
      (source) =>
        source.includes('ac_preoperation_read_only') &&
        source.includes("origem_canal') === 'activecampaign'"),
    ),
  ],
  ['API direta de negócio fica fechada', migration.includes('negocios.updateRule = null')],
  [
    'modelo bloqueia propostas e atividades reais na pré-operação',
    preoperationGuard.includes('Cada callback é autocontido') &&
      (preoperationGuard.match(/function guard\(record\)/g) || []).length === 2 &&
      preoperationGuard.includes("'com_propostas'") &&
      preoperationGuard.includes("'com_proposta_versoes'") &&
      preoperationGuard.includes("'com_atividades'") &&
      preoperationGuard.includes('PREOPERACAO_SOMENTE_LEITURA'),
  ],
]

let failures = 0
for (const [name, ok] of checks) {
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${name}\n`)
  if (!ok) failures++
}
if (failures) process.exit(1)
process.stdout.write(`PASS ${checks.length}/${checks.length}\n`)
