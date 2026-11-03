const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const hook = fs.readFileSync(
  path.join(root, 'pocketbase/hooks/com_nexo_memoria_correcao.js'),
  'utf8',
)
const help = fs.readFileSync(path.join(root, 'pocketbase/hooks/com_propostas_operacao.js'), 'utf8')
const migration = fs.readFileSync(
  path.join(root, 'pocketbase/migrations/202611030020_nexo_memoria_correcoes.js'),
  'utf8',
)

assert.match(hook, /\/memoria\/correcao/)
assert.match(hook, /Object\.keys\(signals\)\.sort\(\)/)
assert.match(hook, /validarLista\('commitment_codes'\)/)
assert.match(hook, /validarLista\('objection_codes'\)/)
assert.match(hook, /validarLista\('risk_codes'\)/)
assert.match(hook, /snapshotHash = \$security\.sha256\(snapshot\)/)
assert.match(hook, /commitment_codes: signals\.commitment_codes\.slice\(\)\.sort\(\)/)
assert.match(hook, /perfil === 'integracao'/)
assert.match(hook, /substituicaoAutoriza/)
assert.match(hook, /escopo === 'todos'/)
assert.match(hook, /runInTransaction/)
assert.doesNotMatch(hook, /instrucao_operador|feedback textual|notas_followups/)
assert.doesNotMatch(hook, /tx\.save\(anteriores\[0\]\)|tx\.delete/)
assert.match(migration, /UNIQUE INDEX .*\(external_id, revision\)/)
assert.match(migration, /createRule: null/)
assert.match(help, /function nexoCorrecaoMemoriaAtiva/)
assert.match(help, /function listaFechada/)
assert.match(help, /allowlists\[nome\]\.indexOf\(valores\[i\]\)/)
assert.match(help, /NEXO_CORRECAO_CANONICA_INVALIDA/)
assert.match(help, /catch \(_\) \{\s*throw new Error\('NEXO_CORRECAO_CANONICA_INDISPONIVEL'\)\s*\}/)
assert.match(help, /payload\.human_memory_correction = humanMemoryCorrectionAtiva/g)
assert.match(help, /if \(humanMemoryCorrectionAtiva\)[\s\S]*NEXO_CORRECAO_CANONICA_INDISPONIVEL/)
assert.match(help, /schema_version: 'nexo_honcho_correction_v1'/)
assert.doesNotMatch(
  help.match(
    /function nexoCorrecaoMemoriaAtiva\(\)[\s\S]*?\n      }\n      var humanMemoryCorrectionAtiva/,
  )[0],
  /usuario_id|snapshot_hash|created_at/,
)
console.log('nexo memoria correcao contract: PASS')
