const fs = require('node:fs')
const hook = fs.readFileSync('pocketbase/hooks/provelo_recovery_admin.js', 'utf8')

const checks = [
  ['rota administrativa dedicada', hook.includes('/integracao/provelo/recuperar-negocio')],
  ['exige SuperAdmin comercial', hook.includes("profile !== 'superadministrador'")],
  ['exige confirmação literal', hook.includes('RECUPERAR NEGOCIO PROVELO')],
  ['exige exclusividade dos canais', hook.includes('EXCLUSIVIDADE_DE_CANAL_NAO_CONFIRMADA')],
  ['proíbe mutação CRM no contrato', hook.includes('ESCOPO_DA_RECUPERACAO_NAO_CONFIRMADO')],
  ['gate desligado bloqueia', hook.includes('INTEGRACAO_PROVELO_DESLIGADA')],
  ['dispatch existente bloqueia duplicação', hook.includes("'provelo-draft|' + dealId")],
  ['comando possui idempotência própria', hook.includes("'provelo-recovery-command|' + dealId")],
  [
    'intenção é gravada antes do relay',
    hook.indexOf("command.set('status', 'pending')") < hook.indexOf('$http.send({'),
  ],
  [
    'relay é chamado internamente e assinado',
    hook.includes("'X-AC-Signature': $security.hs256(relayBody, secret)"),
  ],
  ['timeout termina incerto', hook.includes("command.set('status', 'uncertain')")],
  ['não contém endpoint externo Provelo', !/hook\.us1\.make\.com/.test(hook)],
  [
    'payload auditado não contém dados pessoais',
    !/Email|Vendedor|ValorServico|contactEmail/.test(hook),
  ],
]

let passed = 0
for (const [name, ok] of checks) {
  if (!ok) {
    console.error(`FAIL ${name}`)
    process.exitCode = 1
  } else {
    console.log(`PASS ${name}`)
    passed += 1
  }
}
if (!process.exitCode) console.log(`PASS Provelo recovery admin ${passed}/${checks.length}`)
