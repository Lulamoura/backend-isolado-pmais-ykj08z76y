const fs = require('fs')

const hook = fs.readFileSync('pocketbase/hooks/com_quarentena_testes_executar.js', 'utf8')
const ids = [
  '1gb8b13wky2gvdl',
  '2ism1gf4puqkmom',
  '6lz4lyhbjdh03hx',
  'axg5oe5y1ifox4g',
  'b2oro8l2t78egwk',
  'io77eusp8lu37qu',
  'joyy0k54kbd3bby',
  'kw6c565jj6j6soh',
  'l7pox1ouowsddzj',
  'lbhg291qzuy3xc9',
  'lqdxphf44mrshvj',
  'ni9s9kyijme7azj',
  'xjfnb5w6oh8l0d9',
]

const checks = [
  ['rota transacional separada', hook.includes('/backend/v1/admin/quarentena-testes/executar')],
  ['autenticação obrigatória', hook.includes('$apis.requireAuth()')],
  [
    'SuperAdmin comercial obrigatório',
    hook.includes("perfil($app, ator) !== 'superadministrador'") &&
      hook.includes('ativo_comercial'),
  ],
  ['contrato fechado', hook.includes('command_idempotency_key,confirmacao,fingerprint_versoes')],
  ['modo executar obrigatório', hook.includes("body.modo !== 'executar'")],
  [
    'confirmação literal obrigatória',
    hook.includes('INATIVAR_13_NEGOCIOS_TESTE') && hook.includes('CONFIRMACAO_LITERAL_OBRIGATORIA'),
  ],
  ['lista fechada com 13 IDs', ids.every((id) => hook.includes(`'${id}'`))],
  ['rejeita lista fora do gate', hook.includes('LISTA_FORA_DO_GATE')],
  ['fingerprint SHA-256 obrigatório', hook.includes('FINGERPRINT_INVALIDO')],
  [
    'concorrência antes e dentro da transação',
    (hook.match(/STALE_WRITE/g) || []).length >= 4 && hook.includes('txFingerprint'),
  ],
  [
    'valida marcador e alvo ativo dentro da transação',
    hook.includes('MARCADOR_TESTE_AUSENTE') && hook.includes('ALVO_JA_INATIVO'),
  ],
  ['transação atômica', hook.includes('$app.runInTransaction')],
  [
    'inativa somente negócio-raiz',
    hook.includes("atual.set('inativo', true)") && !hook.includes('$app.delete'),
  ],
  [
    'auditoria individual server-side',
    hook.includes("auditoria.set('collection_name', 'com_negocios')") &&
      hook.includes("auditoria.set('origem', 'server-side')") &&
      hook.includes('auditoriaIds.push'),
  ],
  [
    'idempotência concluída',
    [
      'command_idempotency_key',
      'payload_hash',
      "idem.set('estado', 'concluido')",
      'lease_ate',
    ].every((x) => hook.includes(x)),
  ],
  ['replay sem nova escrita', hook.includes('replay: true') && hook.includes('parseResultado')],
  ['filhos declarados preservados', hook.includes('filhos_preservados: true')],
  ['não expõe endpoint GET de execução', !hook.includes("'GET'")],
]

let passed = 0
for (const [name, ok] of checks) {
  console.log(`TEST ${ok ? 'PASS' : 'FAIL'}: ${name}`)
  if (ok) passed += 1
}
console.log(`\nRESULTADO: ${passed}/${checks.length} aprovados`)
process.exitCode = passed === checks.length ? 0 : 1
