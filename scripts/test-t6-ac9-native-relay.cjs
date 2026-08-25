const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const relay = fs.readFileSync(path.join(root, 'pocketbase/hooks/ac_native_relay.js'), 'utf8')
const controls = fs.readFileSync(path.join(root, 'pocketbase/hooks/ac_runtime_controls.js'), 'utf8')
const webhook = fs.readFileSync(path.join(root, 'pocketbase/hooks/ac_webhook.js'), 'utf8')
const reconciler = fs.readFileSync(
  path.join(root, 'pocketbase/hooks/com_ac_reconciliacao.js'),
  'utf8',
)

const checks = [
  ['relay possui rota exclusiva', relay.includes("'/backend/v1/integracao/ac/relay-v1'")],
  ['relay começa pelo gate desligado', relay.includes("paramTrue('ac_webhook_enabled')")],
  ['relay limita form-urlencoded', relay.includes('application/x-www-form-urlencoded')],
  ['relay verifica HMAC do corpo bruto', relay.includes('$security.hs256(rawBody, secret)')],
  ['relay compara assinatura em tempo constante', relay.includes('diff |= left.charCodeAt(i)')],
  [
    'relay aceita somente add/update de negócio',
    relay.includes("eventType !== 'deal_add'") && relay.includes("eventType !== 'deal_update'"),
  ],
  [
    'relay hidrata negócio em leitura',
    relay.includes("'/api/3/deals/'") && relay.includes("method: 'GET'"),
  ],
  [
    'relay hidrata contato, empresa e etapa',
    relay.includes("'/api/3/contacts/'") &&
      relay.includes("'/api/3/accounts/'") &&
      relay.includes("'/api/3/dealStages/'"),
  ],
  [
    'relay usa campos comerciais canônicos',
    relay.includes("customByLabel['Responsável']") && relay.includes("customByLabel['Modalidade']"),
  ],
  [
    'relay e reconciliação preservam contexto gerencial do CRM',
    relay.includes('crm_created_at') &&
      relay.includes("customByLabel['Fase']") &&
      relay.includes("customByLabel['Fonte de Prospecção']") &&
      reconciler.includes("customFields['Fase']") &&
      reconciler.includes("customFields['Fonte de Prospecção']") &&
      /target\.set\(\s*'proxima_acao_em'/.test(webhook) &&
      /target\.set\(\s*'fase_crm'/.test(webhook) &&
      /target\.set\(\s*'fonte_prospeccao'/.test(reconciler),
  ],
  [
    'relay e reconciliação transportam motivo e data da perda',
    relay.includes("customByLabel['Motivo Perda']") &&
      relay.includes("customByLabel['Data_Cancelamento']") &&
      reconciler.includes("customFields['Motivo Perda']") &&
      reconciler.includes("customFields['Data_Cancelamento']") &&
      webhook.includes("target.set('fechamento_motivo'") &&
      webhook.includes("target.set('fechamento_data'") &&
      reconciler.includes("target.set('fechamento_motivo'") &&
      reconciler.includes("target.set('fechamento_data'"),
  ],
  [
    'novo contexto comercial reprocessa negócios já sincronizados sem duplicação',
    relay.includes("context_revision: type === 'business' ? '5' : '1'") &&
      relay.includes("type === 'business' ? ':ctx5' : ''") &&
      reconciler.includes("context_revision: entityType === 'business' ? '5' : '1'") &&
      reconciler.includes("entityType === 'business' ? ':ctx5' : ''"),
  ],
  [
    'webhook preserva o valor inteiro em centavos',
    webhook.includes("target.set('valor', Math.round(Number(event.data.value_cents || 0)))") &&
      !webhook.includes("target.set('valor', Number(event.data.value_cents || 0) / 100)"),
  ],
  [
    'reconciliação preserva o valor inteiro em centavos',
    reconciler.includes("target.set('valor', Math.round(Number(ev.data.value_cents || 0)))") &&
      !reconciler.includes("target.set('valor', Number(ev.data.value_cents || 0) / 100)"),
  ],
  [
    'webhook normaliza modalidades do ActiveCampaign',
    webhook.includes("modality === 'serv. recorrente'") &&
      webhook.includes("modality === 'serv. eventual'") &&
      webhook.includes("modality === 'eventos'") &&
      webhook.includes("target.set('modalidade', 'evento')") &&
      webhook.includes("target.set('modalidade', 'serv_eventual')") &&
      webhook.includes("throw new Error('MODALIDADE_AC_INVALIDA')"),
  ],
  [
    'reconciliação normaliza modalidades do ActiveCampaign',
    reconciler.includes("modality === 'serv. recorrente'") &&
      reconciler.includes("modality === 'serv. eventual'") &&
      reconciler.includes("modality === 'eventos'") &&
      reconciler.includes("target.set('modalidade', 'evento')") &&
      reconciler.includes("target.set('modalidade', 'serv_eventual')") &&
      reconciler.includes("throw new Error('MODALIDADE_AC_INVALIDA')"),
  ],
  ['relay não usa proprietário técnico como fallback', !relay.includes('String(deal.owner')],
  ['relay encaminha somente ao envelope V1', relay.includes("'/backend/v1/integracao/ac/webhook'")],
  [
    'relay assina novamente o envelope interno',
    relay.includes("'X-AC-Signature': $security.hs256(body, secret)"),
  ],
  [
    'relay não escreve no ActiveCampaign',
    !/method:\s*'(POST|PUT|PATCH|DELETE)'[\s\S]{0,160}Api-Token/.test(relay),
  ],
  [
    'gate real possui rota própria',
    controls.includes("'/backend/v1/integracao/ac/configuracao/webhook-real'"),
  ],
  [
    'gate real exige confirmações literais',
    controls.includes('ATIVAR WEBHOOK REAL T6.AC.9') &&
      controls.includes('DESATIVAR WEBHOOK REAL T6.AC.9'),
  ],
  [
    'gate real mantém sintético e reconciliação desligados',
    controls.includes("synthetic.set('valor', 'false')") &&
      controls.includes("reconciliation.set('valor', 'false')"),
  ],
  ['gate real restaura cursor', controls.includes("cursor.set('valor', 'UNINITIALIZED')")],
  [
    'gate real audita abertura e fechamento',
    controls.includes("'real_webhook_open'") && controls.includes("'real_webhook_close'"),
  ],
  [
    'gate real é idempotente',
    controls.includes("$security.sha256('real-webhook-gate|' + commandKey)"),
  ],
  [
    'gate de reconciliação real possui rota própria',
    controls.includes("'/backend/v1/integracao/ac/configuracao/reconciliacao-real'"),
  ],
  [
    'catálogo de modalidades possui materialização administrativa controlada',
    controls.includes("'/backend/v1/integracao/ac/configuracao/modalidades'") &&
      controls.includes("'APLICAR MODALIDADES COMERCIAIS ACTIVECAMPAIGN'") &&
      controls.includes("['recorrente', 'evento', 'serv_eventual']"),
  ],
  [
    'gate de reconciliação preserva webhook e cursor',
    controls.includes("webhook_enabled: webhook.getString('valor') === 'true'") &&
      controls.includes("cursor: cursor.getString('valor')"),
  ],
  [
    'gate de reconciliação mantém canal sintético desligado',
    controls.includes("throw new Error('GATE_SINTETICO_ATIVO')") &&
      controls.includes("synthetic.set('valor', 'false')"),
  ],
  [
    'gate de reconciliação é auditado e idempotente',
    controls.includes("$security.sha256('real-reconciliation-gate|' + commandKey)") &&
      controls.includes("'real_reconciliation_gate_open'") &&
      controls.includes("'real_reconciliation_gate_close'"),
  ],
]

let passed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (ok) passed++
}
console.log(`\n${passed}/${checks.length} checks passed`)
if (passed !== checks.length) process.exit(1)
