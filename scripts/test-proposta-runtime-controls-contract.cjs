const fs = require('fs')
const hook = fs.readFileSync('pocketbase/hooks/com_proposta_runtime_controls.js', 'utf8')
const checks = [
  [
    'rota autenticada',
    hook.includes("'/backend/v1/propostas/configuracao/gate'") &&
      hook.includes("$apis.requireAuth('users')"),
  ],
  [
    'somente SuperAdministrador ativo',
    hook.includes("getBool('ativo_comercial')") && hook.includes("perfil !== 'superadministrador'"),
  ],
  [
    'whitelist restrita aos dois gates',
    hook.includes("'proposta.pagina_publica_habilitada': true") &&
      hook.includes("'proposta.email_habilitado': true"),
  ],
  [
    'um gate por comando',
    hook.includes('var chave = String(body.chave') && !hook.includes('Object.assign'),
  ],
  ['valor booleano estrito', hook.includes("typeof valor !== 'boolean'")],
  [
    'confirmação explícita para abrir e fechar',
    hook.includes('ABRIR GATE DE PROPOSTA') && hook.includes('FECHAR GATE DE PROPOSTA'),
  ],
  [
    'concorrência otimista',
    hook.includes("getString('updated') !== updatedEsperado") &&
      hook.includes("error: 'STALE_WRITE'"),
  ],
  [
    'idempotência persistida',
    hook.includes("$security.sha256('proposal-gate|'") &&
      hook.includes("evento_tipo', 'proposal_gate_control'") &&
      hook.includes("status', 'processed'"),
  ],
  ['transação única', hook.includes('$app.runInTransaction(function (tx)')],
  [
    'auditoria server-side',
    hook.includes("comando', 'alterar_gate_proposta'") && hook.includes("origem', 'server-side'"),
  ],
  ['limite de corpo', hook.includes('$apis.bodyLimit(2048)')],
  ['compatível com JSVM', !/^function\s+/m.test(hook) && !/^var\s+\w+\s*=\s*function/m.test(hook)],
]
let passed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (ok) passed++
}
console.log(`\n${passed}/${checks.length} verificações aprovadas`)
if (passed !== checks.length) process.exit(1)
