const assert = require('assert')
const fs = require('fs')
const { parseSync } = require('oxc-parser')

const establishedHook = fs.readFileSync('pocketbase/hooks/com_propostas_operacao.js', 'utf8')
const retiredHook = fs.readFileSync('pocketbase/hooks/com_nexo_central_operacional.js', 'utf8')
const establishedParse = parseSync('com_propostas_operacao.js', establishedHook)
assert.deepEqual(establishedParse.errors, [], 'hook materializado deve ser sintaticamente válido')

const routes = [
  '/backend/v1/nexo/curadoria/triagem-shadow',
  '/backend/v1/nexo/curadoria/casos/consolidar',
  '/backend/v1/nexo/curadoria/fontes/{source}/eventos/{eventId}',
  '/backend/v1/nexo/curadoria/casos/listar',
  '/backend/v1/nexo/curadoria/casos/{id}/transicionar',
  '/backend/v1/nexo/curadoria/outbox/{id}/retry',
  '/backend/v1/nexo/curadoria/outbox/processar',
]

function occurrences(source, needle) {
  return source.split(needle).length - 1
}

function callbackBlock(source, route) {
  let callback = null

  function visit(node) {
    if (!node || typeof node !== 'object' || callback) return
    if (
      node.type === 'CallExpression' &&
      node.callee &&
      node.callee.type === 'Identifier' &&
      node.callee.name === 'routerAdd' &&
      node.arguments &&
      node.arguments[1] &&
      node.arguments[1].value === route
    ) {
      callback = node.arguments[2]
      return
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const item of value) visit(item)
      } else if (value && typeof value === 'object') {
        visit(value)
      }
    }
  }

  visit(establishedParse.program)
  assert(callback, `rota ${route} deve existir no hook materializado`)
  assert.equal(callback.type, 'FunctionExpression', `rota ${route} deve usar callback explícito`)
  return source.slice(callback.start, callback.end)
}

for (const route of routes) {
  assert.equal(
    occurrences(establishedHook, `'${route}'`),
    1,
    `rota ${route} deve existir uma única vez em com_propostas_operacao.js`,
  )
  assert.equal(
    occurrences(retiredHook, `'${route}'`),
    0,
    `rota ${route} não pode permanecer em com_nexo_central_operacional.js`,
  )

  const callback = callbackBlock(establishedHook, route)
  const helperNames = new Set(callback.match(/\bnexoCuradoriaCasos?[A-Z][A-Za-z0-9_]*/g) || [])
  for (const helperName of helperNames) {
    assert.match(
      callback,
      new RegExp(`function\\s+${helperName}\\s*\\(`),
      `callback de ${route} deve declarar localmente o helper ${helperName}`,
    )
  }
}

assert.equal(
  occurrences(establishedHook, 'function nexoCuradoriaCasosPerfil(e)'),
  4,
  'as quatro rotas autenticadas devem materializar o helper de autorização localmente',
)
assert.equal(
  occurrences(establishedHook, "$app.findRecordById('users', authActorId)"),
  4,
  'cada helper local deve validar o ator pelo registro canônico em users',
)
assert.equal(
  occurrences(establishedHook, 'actor.collection'),
  0,
  'autorização não pode depender da introspecção de collection do auth record',
)

const listCallback = callbackBlock(establishedHook, '/backend/v1/nexo/curadoria/casos/listar')
const transitionCallback = callbackBlock(
  establishedHook,
  '/backend/v1/nexo/curadoria/casos/{id}/transicionar',
)
const processorCallback = callbackBlock(
  establishedHook,
  '/backend/v1/nexo/curadoria/outbox/processar',
)

function localCanonicalHelper(callback) {
  const start = callback.indexOf('function nexoCuradoriaJsonCanonico(value)')
  const end = callback.indexOf('\n\n    function ', start + 1)
  assert(start >= 0 && end > start, 'helper canônico local deve ter limites reconhecíveis')
  return callback.slice(start, end)
}

function localArrayHelper(callback) {
  const start = callback.indexOf('function nexoCuradoriaCasosArray(record, field)')
  const end = callback.indexOf('\n\n    function ', start + 1)
  assert(start >= 0 && end > start, 'helper de arrays local deve ter limites reconhecíveis')
  return callback.slice(start, end)
}

const listArrayHelper = localArrayHelper(listCallback)
const transitionArrayHelper = localArrayHelper(transitionCallback)
assert.strictEqual(
  listArrayHelper,
  transitionArrayHelper,
  'listagem e transição devem materializar helpers de arrays locais idênticos',
)
for (const [route, helper] of [
  ['/backend/v1/nexo/curadoria/casos/listar', listArrayHelper],
  ['/backend/v1/nexo/curadoria/casos/{id}/transicionar', transitionArrayHelper],
]) {
  assert.match(
    helper,
    /var originalRaw = \[\][\s\S]*var byteBuffer = originalRaw && typeof originalRaw === 'object' && originalRaw\.length > 0/,
    `callback de ${route} deve exigir buffer não vazio antes de decodificar JSONRaw`,
  )
  assert.match(
    helper,
    /for \(var i = 0; i < originalRaw\.length; i\+\+\)[\s\S]*typeof originalRaw\[i\] !== 'number'[\s\S]*originalRaw\[i\] < 0[\s\S]*originalRaw\[i\] > 255[\s\S]*Math\.floor\(originalRaw\[i\]\) !== originalRaw\[i\]/,
    `callback de ${route} deve aceitar como JSONRaw apenas bytes inteiros entre 0 e 255`,
  )
  assert.match(
    helper,
    /var decodedRaw[\s\S]*if \(byteBuffer\)[\s\S]*decodedRaw = JSON\.parse\(String\(originalRaw\)\)[\s\S]*if \(Array\.isArray\(decodedRaw\)\) return decodedRaw/,
    `callback de ${route} deve adotar JSONRaw somente quando decodificar um array`,
  )
  assert.match(
    helper,
    /if \(Array\.isArray\(originalRaw\)\) return originalRaw[\s\S]*if \(typeof originalRaw === 'string'\)/,
    `callback de ${route} deve preservar o array original quando a ponte não decodifica um array`,
  )
  assert.doesNotMatch(
    helper,
    /originalRaw\s*=\s*JSON\.parse/,
    `callback de ${route} não pode sobrescrever o valor original durante tentativa de decode`,
  )
  assert.doesNotMatch(
    helper,
    /String\(raw\)\.charAt\(0\)/,
    `callback de ${route} não pode inferir JSONRaw pelo primeiro caractere serializado`,
  )
}
for (const [route, callback] of [
  ['/backend/v1/nexo/curadoria/casos/{id}/transicionar', transitionCallback],
  ['/backend/v1/nexo/curadoria/outbox/processar', processorCallback],
]) {
  assert.match(
    callback,
    /function nexoCuradoriaJsonCanonico\(value\)[\s\S]*Object\.keys\(value\)\.sort\(\)/,
    `callback de ${route} deve materializar serialização JSON canônica recursiva local`,
  )
}
assert.strictEqual(
  localCanonicalHelper(transitionCallback),
  localCanonicalHelper(processorCallback),
  'transição e processador devem usar helpers canônicos locais idênticos',
)
assert.match(
  processorCallback,
  /var payloadByteBuffer = Array\.isArray\(payload\) && payload\.length > 0[\s\S]*for \(var pbi = 0; pbi < payload\.length; pbi\+\+\)[\s\S]*typeof payload\[pbi\] !== 'number'[\s\S]*payload\[pbi\] < 0[\s\S]*payload\[pbi\] > 255[\s\S]*Math\.floor\(payload\[pbi\]\) !== payload\[pbi\]/,
  'processador deve qualificar JSONRaw como buffer não vazio de bytes inteiros',
)
assert.match(
  processorCallback,
  /if \(payloadByteBuffer\)[\s\S]*decodedPayload = JSON\.parse\(String\(payload\)\)[\s\S]*decodedPayload\s*&&\s*typeof decodedPayload === 'object'\s*&&\s*!Array\.isArray\(decodedPayload\)[\s\S]*payload = decodedPayload[\s\S]*Array\.isArray\(payload\)[\s\S]*PAYLOAD_INVALIDO/,
  'processador deve adotar somente objeto JSONRaw decodificado e rejeitar arrays restantes',
)
assert.doesNotMatch(
  processorCallback,
  /String\(payload\)\.charAt\(0\)/,
  'processador não pode confiar em prefixo serializado para identificar JSONRaw',
)
assert.match(
  transitionCallback,
  /payloadSerializado\s*=\s*nexoCuradoriaJsonCanonico\(payloadConhecimento\)/,
  'transição deve persistir hash dos bytes canônicos do payload',
)
assert.match(
  processorCallback,
  /payloadBody\s*=\s*nexoCuradoriaJsonCanonico\(payload\)/,
  'processador deve enviar e recalcular hash dos mesmos bytes canônicos',
)

function namedFunctionBlock(callback, name) {
  const start = callback.indexOf(`function ${name}(`)
  assert(start >= 0, `helper local ${name} deve existir`)
  const bodyStart = callback.indexOf('{', start)
  let depth = 0
  let quote = ''
  let escaped = false
  for (let index = bodyStart; index < callback.length; index += 1) {
    const character = callback[index]
    if (quote) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === quote) quote = ''
      continue
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character
      continue
    }
    if (character === '{') depth += 1
    if (character === '}') {
      depth -= 1
      if (depth === 0) return callback.slice(start, index + 1)
    }
  }
  assert.fail(`helper local ${name} deve ter bloco balanceado`)
}

const transitionPayloadBuilder = namedFunctionBlock(
  transitionCallback,
  'nexoCuradoriaPayloadConhecimento',
)
const processorPayloadBuilder = namedFunctionBlock(
  processorCallback,
  'nexoCuradoriaPayloadConhecimento',
)
function normalizeFunctionSource(source) {
  return source.replace(/\s+/g, '').replace(/,\)/g, ')')
}
assert.strictEqual(
  normalizeFunctionSource(transitionPayloadBuilder),
  normalizeFunctionSource(processorPayloadBuilder),
  'criação e processamento devem reconstruir o payload com helper local idêntico',
)
assert.match(
  processorCallback,
  /decisaoIdAutoritativa[\s\S]*findRecordById\([\s\S]*com_nexo_curadoria_transicoes[\s\S]*metadadosTransicao[\s\S]*revisaoAnteriorTransicao !== revisaoAutoritativa - 1[\s\S]*revisaoNovaTransicao !== revisaoAutoritativa[\s\S]*vinculoAcaoValido/,
  'processador deve validar vínculo, ação e revisões da transição autoritativa',
)
assert.match(
  processorCallback,
  /payloadAutoritativoBody = nexoCuradoriaJsonCanonico\(payloadAutoritativo\)[\s\S]*payloadBody = nexoCuradoriaJsonCanonico\(payload\)[\s\S]*payloadBody !== payloadAutoritativoBody[\s\S]*PAYLOAD_INVALIDO/,
  'processador deve exigir igualdade canônica exata com o payload reconstruído',
)
assert.match(
  processorCallback,
  /status[^\n]*!== 'processando'[\s\S]*claim_token[^\n]*!== claimToken[\s\S]*payloadHashLegado = String\(\$security\.sha256\(JSON\.stringify\(payloadAutoritativo\)\)\)[\s\S]*payloadHashPersistido !== payloadHashLegado[\s\S]*PAYLOAD_HASH_DIVERGENTE[\s\S]*set\('payload_hash', payloadHash\)[\s\S]*tx\.save\(atualPreHttp\)/,
  'reparo legado deve ocorrer dentro do claim vigente e aceitar somente o hash pré-canônico esperado',
)
assert.match(
  transitionCallback,
  /runInTransaction\(function \(tx\)[\s\S]*findRecordsByFilter\([\s\S]*com_nexo_curadoria_outbox[\s\S]*caso_id[\s\S]*status = 'processando'[\s\S]*claim_token[\s\S]*claim_expires_at[\s\S]*PUBLICACAO_EM_ANDAMENTO[\s\S]*caso\.set\('status'/,
  'transição deve cercar o caso contra claim processando vigente antes de qualquer mudança de estado',
)
assert.match(
  processorCallback,
  /status[^\n]*!== 'processando'[\s\S]*claim_token[^\n]*!== claimToken[\s\S]*idempotencyKeyAutoritativa = String\([\s\S]*\[\s*'curadoria-outbox-v1',\s*casoIdAutoritativo,\s*String\(revisaoAutoritativa\),\s*acaoAutoritativa,?\s*\]\.join\('\|'\)[\s\S]*idempotency_key'[\s\S]*!==[\s\S]*idempotencyKeyAutoritativa[\s\S]*IDEMPOTENCY_KEY_INVALIDA/,
  'processador deve validar a chave de idempotência autoritativa dentro do claim antes do HTTP',
)
assert(
  processorCallback.indexOf('payloadBody !== payloadAutoritativoBody') <
    processorCallback.indexOf('var signature = $security.hs256'),
  'validação autoritativa deve ocorrer antes de assinar o transporte',
)
assert(
  processorCallback.indexOf("set('payload_hash', payloadHash)") <
    processorCallback.indexOf('var response = $http.send'),
  'reparo legado deve persistir o hash canônico antes do HTTP',
)

console.log('Curadoria hook materialization contract: PASS')
