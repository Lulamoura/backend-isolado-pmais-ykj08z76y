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
      reconciliationHook.includes("com_qualificacao_historico") &&
      reconciliationHook.includes("historico[0].getString('estado_novo') === 'desqualificada'") &&
      reconciliationHook.includes('devePreservarDesqualificacaoLocal(tx, target)') &&
      reconciliationHook.includes("target.set('resultado', 'desqualificado')") &&
      reconciliationHook.includes("target.set('qualificacao', 'desqualificada')") &&
      reconciliationHook.includes('preserveLocalProspectDisqualification ? true : ev.action === \'archive\''),
  ],
  [
    'webhook preserva desqualificação local quando o AC reenvia prospect aberto',
    webhookHook.includes('function devePreservarDesqualificacaoLocal(app, negocio)') &&
      webhookHook.includes("com_qualificacao_historico") &&
      webhookHook.includes("historico[0].getString('estado_novo') === 'desqualificada'") &&
      webhookHook.includes('devePreservarDesqualificacaoLocal(tx, target)') &&
      webhookHook.includes("target.set('resultado', 'desqualificado')") &&
      webhookHook.includes("target.set('qualificacao', 'desqualificada')") &&
      webhookHook.includes('preserveLocalProspectDisqualification ? true : event.action === \'archive\''),
  ],
  [
    'reconciliação não reativa agenda de recuperação já descartada',
    reconciliationHook.includes("existingAgenda.getString('estado') !== 'descartada'") &&
      reconciliationHook.includes("newAgenda.set('estado', 'ativa')") &&
      reconciliationHook.includes("'activecampaign:recovery:' + ev.entity_id"),
  ],
  [
    'reparo administrativo dos seis casos exige confirmação literal e audita mutações',
    reconciliationHook.includes('/backend/v1/admin/ac-local-decisions/reparar-casos') &&
      reconciliationHook.includes('REPARAR DECISOES LOCAIS 4790 4787 4786 4667 4655 4653') &&
      reconciliationHook.includes("slug !== 'superadministrador'") &&
      reconciliationHook.includes("comando', 'ac_local_decision_repair_desqualificacao'") &&
      reconciliationHook.includes("comando', 'ac_local_decision_repair_recuperacao'") &&
      reconciliationHook.includes("external_id: externalProspect") &&
      reconciliationHook.includes("external_id: externalRecuperacao") &&
      reconciliationHook.includes("motivo_adiamento_descarte") &&
      reconciliationHook.includes("local_decisions_repair"),
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
