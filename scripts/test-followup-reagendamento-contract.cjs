const fs = require('node:fs')
const assert = require('node:assert/strict')

const migration = fs.readFileSync(
  'pocketbase/migrations/202608280720_followup_reagendamento.js',
  'utf8',
)
const webhook = fs.readFileSync('pocketbase/hooks/ac_webhook.js', 'utf8')
const reconciliation = fs.readFileSync('pocketbase/hooks/com_ac_reconciliacao.js', 'utf8')
const proposals = fs.readFileSync('pocketbase/hooks/com_propostas_operacao.js', 'utf8')
const closings = fs.readFileSync('pocketbase/hooks/com_fechamentos_operacao.js', 'utf8')
const orders = fs.readFileSync('pocketbase/hooks/com_ordens_execucao.js', 'utf8')

assert.match(migration, /reagendamento_external_id/)
assert.match(migration, /UNIQUE INDEX idx_com_negocio_historico_reagendamento_external/)
for (const source of [webhook, reconciliation]) {
  assert.match(source, /function actionDateKey\(value\)/)
  assert.match(source, /text\.match\(\/\^\(\\d\{4\}-\\d\{2\}-\\d\{2\}\)\//)
  assert.match(source, /actionDateKey\(previousNextAction\) !== actionDateKey\(nextAction\)/)
  assert.match(source, /activecampaign_data_acao/)
  assert.match(source, /:next_action/)
}
for (const source of [proposals, closings, orders]) {
  assert.match(source, /follow_up_pendente/)
  assert.match(source, /ultimaNotaEm.*reagendadaEm/s)
}
console.log('followup-reagendamento contract: PASS')
