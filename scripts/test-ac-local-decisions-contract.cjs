const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const reconciliationHook = fs.readFileSync(
  path.join(root, 'pocketbase/hooks/com_ac_reconciliacao.js'),
  'utf8',
)
const webhookHook = fs.readFileSync(path.join(root, 'pocketbase/hooks/ac_webhook.js'), 'utf8')

const checks = [
  [
    'reconciliação preserva desqualificação local mesmo quando o AC reenvia prospect aberto',
    reconciliationHook.includes('function devePreservarDesqualificacaoLocal(app, negocio)') &&
      reconciliationHook.includes('com_qualificacao_historico') &&
      reconciliationHook.includes("historico[0].getString('estado_novo') === 'desqualificada'") &&
      reconciliationHook.includes('devePreservarDesqualificacaoLocal(tx, target)') &&
      reconciliationHook.includes("target.set('resultado', 'desqualificado')") &&
      reconciliationHook.includes("target.set('qualificacao', 'desqualificada')") &&
      reconciliationHook.includes(
        "preserveLocalProspectDisqualification ? true : ev.action === 'archive'",
      ),
  ],
  [
    'webhook preserva desqualificação local quando o AC reenvia prospect aberto',
    webhookHook.includes('function devePreservarDesqualificacaoLocal(app, negocio)') &&
      webhookHook.includes('com_qualificacao_historico') &&
      webhookHook.includes("historico[0].getString('estado_novo') === 'desqualificada'") &&
      webhookHook.includes('devePreservarDesqualificacaoLocal(tx, target)') &&
      webhookHook.includes("target.set('resultado', 'desqualificado')") &&
      webhookHook.includes("target.set('qualificacao', 'desqualificada')") &&
      webhookHook.includes(
        "preserveLocalProspectDisqualification ? true : event.action === 'archive'",
      ),
  ],
  [
    'reconciliação não reativa agenda de recuperação já descartada',
    reconciliationHook.includes("existingAgenda.getString('estado') !== 'descartada'") &&
      reconciliationHook.includes("newAgenda.set('estado', 'ativa')") &&
      reconciliationHook.includes("'activecampaign:recovery:' + ev.entity_id"),
  ],
  [
    'webhook não reativa agenda de recuperação já descartada',
    webhookHook.includes("existingAgenda.getString('estado') !== 'descartada'") &&
      webhookHook.includes("newAgenda.set('estado', 'ativa')") &&
      webhookHook.includes("'activecampaign:recovery:' + event.entity_id"),
  ],
]

let failures = 0
for (const [name, ok] of checks) {
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${name}\n`)
  if (!ok) failures++
}
if (failures) process.exit(1)
process.stdout.write(`PASS ${checks.length}/${checks.length}\n`)
