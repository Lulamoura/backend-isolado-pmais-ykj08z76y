const fs = require('fs')

const hook = fs.readFileSync('pocketbase/hooks/com_quarentena_testes_dry_run.js', 'utf8')
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
  ['rota administrativa de dry-run', hook.includes('/backend/v1/admin/quarentena-testes/dry-run')],
  ['autenticação obrigatória', hook.includes('$apis.requireAuth()')],
  [
    'restrição a SuperAdmin comercial',
    hook.includes("perfil !== 'superadministrador'") && hook.includes('ativo_comercial'),
  ],
  [
    'somente campos fechados',
    hook.includes("chaves.join(',') !== 'modo,negocio_ids'") && hook.includes('CAMPOS_INVALIDOS'),
  ],
  ['modo dry-run obrigatório', hook.includes("body.modo !== 'dry_run'")],
  ['lista fechada com 13 IDs', ids.every((id) => hook.includes(`'${id}'`))],
  ['rejeita lista fora do gate', hook.includes('LISTA_FORA_DO_GATE')],
  ['valida existência de cada negócio', hook.includes('NEGOCIO_DO_GATE_AUSENTE')],
  ['valida marcador de teste', hook.includes("titulo.indexOf('[TESTE]')")],
  ['expõe versão esperada', hook.includes('updated_esperado')],
  [
    'gera fingerprint das versões',
    hook.includes('fingerprint_versoes') && hook.includes('$security.sha256'),
  ],
  [
    'retorna contagens antes e depois',
    hook.includes('antes:') && hook.includes('depois_previsto:'),
  ],
  [
    'preserva trilhas e filhos',
    ['atividades', 'proposta_versoes', 'qualificacao_historico', 'recuperacao_agendas'].every((x) =>
      hook.includes(x),
    ),
  ],
  [
    'declara zero mutações',
    hook.includes('somente_leitura: true') && hook.includes('mutacoes_executadas: 0'),
  ],
  [
    'não contém primitivas de escrita',
    !['$app.save(', '$app.delete(', '.set(', 'runInTransaction'].some((x) => hook.includes(x)),
  ],
  ['para no próximo gate', hook.includes('AUTORIZACAO_EXPLICITA_PARA_IMPLEMENTAR_EXECUCAO')],
]

let passed = 0
for (const [name, ok] of checks) {
  console.log(`TEST ${ok ? 'PASS' : 'FAIL'}: ${name}`)
  if (ok) passed += 1
}
console.log(`\nRESULTADO: ${passed}/${checks.length} aprovados`)
process.exitCode = passed === checks.length ? 0 : 1
