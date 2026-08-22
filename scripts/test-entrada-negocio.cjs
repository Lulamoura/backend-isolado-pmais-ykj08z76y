const fs = require('fs'),
  path = require('path')
const src = fs.readFileSync(
  path.join(__dirname, '..', 'pocketbase', 'hooks', 'com_entrada_negocio.js'),
  'utf8',
)
const checks = [
  ['rota transacional', /routerAdd\(\s*'POST',\s*'\/backend\/v1\/negocios\/entrada'/.test(src)],
  ['autenticacao', src.includes('$apis.requireAuth()')],
  ['usuario comercial ativo', src.includes("getBool('ativo_comercial')")],
  ['idempotencia', src.includes("'com_idempotencia'") && src.includes("'criar_oportunidade'")],
  ['lease obrigatorio', src.includes("idem.set('lease_ate'")],
  ['transacao', src.includes('$app.runInTransaction')],
  ['modo pendente', src.includes("'producao_proposta' : 'prospects'")],
  ['modo pre qualificado', src.includes("'qualificada' : 'pendente'")],
  [
    'campos minimos',
    src.includes('PRE_QUALIFICACAO_INCOMPLETA') &&
      src.includes('contato_principal_id') &&
      src.includes('proxima_acao') &&
      src.includes('proxima_acao_em'),
  ],
  [
    'historico auditado',
    src.includes("'com_qualificacao_historico'") && src.includes("'entrada_pre_qualificada'"),
  ],
  ['auditoria server side', src.includes("'com_auditoria'") && src.includes("'server-side'")],
  ['proxima acao criada', src.includes("'com_atividades'") && src.includes("'planejada'")],
  ['autor autenticado', /h\.set\('autor_id',\s*ator\.id\)/.test(src)],
  ['replay imutavel', /replay:\s*true/.test(src)],
  [
    'replay recupera ids canonicos',
    src.includes("getString('registros_afetados')") &&
      src.includes('JSON.parse') &&
      src.includes('negocio_id: afetados.length ? afetados[0]'),
  ],
]
let fail = 0
for (const [n, ok] of checks) {
  console.log(`${ok ? 'TEST PASS' : 'TEST FAIL'}: ${n}`)
  if (!ok) fail++
}
console.log(`\nRESULTADO: ${checks.length - fail}/${checks.length} aprovados`)
process.exitCode = fail ? 1 : 0
