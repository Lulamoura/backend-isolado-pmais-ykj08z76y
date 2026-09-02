const fs = require('fs')
const path = 'pocketbase/migrations/202609021830_proposta_publica_v1_foundation.js'
const migration = fs.readFileSync(path, 'utf8')

const checks = [
  [
    'migration aditiva e idempotente',
    migration.includes('fields.getByName') && migration.includes('findCollectionByNameOrId'),
  ],
  ['sem alteração de migrations anteriores', fs.existsSync(path)],
  [
    'aprovação opcional desligada',
    migration.includes("'proposta.aprovacao_interna_obrigatoria'") &&
      migration.includes("'false',\n        'booleano',\n        'Aprovação interna"),
  ],
  [
    'página pública desligada',
    migration.includes("['proposta.pagina_publica_habilitada', 'false'"),
  ],
  ['email desligado', migration.includes("['proposta.email_habilitado', 'false'")],
  [
    'PDF privado e limitado a 20 MB',
    migration.includes("mimeTypes: ['application/pdf']") &&
      migration.includes('maxSize: 20971520') &&
      migration.includes('protected: true'),
  ],
  [
    'token apenas em hash e prefixo',
    migration.includes("name: 'token_hash'") &&
      migration.includes("name: 'token_prefix'") &&
      !migration.includes("name: 'token_puro'"),
  ],
  ['token hash único', migration.includes('UNIQUE INDEX idx_com_proposta_publicacoes_token_hash')],
  ['uma publicação ativa por proposta', migration.includes('idx_com_proposta_publicacoes_ativa')],
  [
    'eventos públicos mínimos',
    [
      'pagina_acessada',
      'pdf_baixado',
      'duvida_iniciada',
      'aceite_confirmado',
      'recusa_confirmada',
    ].every((x) => migration.includes(x)),
  ],
  [
    'envios idempotentes',
    migration.includes('idx_com_proposta_envios_idem') &&
      migration.includes("name: 'command_idempotency_key'"),
  ],
  [
    'coleções sem acesso direto',
    (migration.match(/createRule: null/g) || []).length >= 3 &&
      (migration.match(/listRule: null/g) || []).length >= 3,
  ],
  [
    'nenhum hook ou endpoint no lote A',
    !migration.includes('routerAdd(') && !migration.includes('$http.send'),
  ],
  ['nenhuma função de topo usada por callback de rota', !migration.includes('routerAdd')],
]

let passed = 0
for (const [name, ok] of checks) {
  console.log(`TEST ${ok ? 'PASS' : 'FAIL'}: ${name}`)
  if (ok) passed++
}
console.log(`\nRESULTADO: ${passed}/${checks.length} aprovados`)
process.exitCode = passed === checks.length ? 0 : 1
