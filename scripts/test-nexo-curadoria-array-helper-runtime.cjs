const assert = require('assert')
const fs = require('fs')
const vm = require('vm')
const { parseSync } = require('oxc-parser')

const hook = fs.readFileSync('pocketbase/hooks/com_propostas_operacao.js', 'utf8')
const parsed = parseSync('com_propostas_operacao.js', hook)
assert.deepStrictEqual(parsed.errors, [], 'hook deve ser sintaticamente válido')

function callbackBlock(route) {
  let callback = null

  function visit(node) {
    if (!node || typeof node !== 'object' || callback) return
    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'Identifier' &&
      node.callee.name === 'routerAdd' &&
      node.arguments?.[1]?.value === route
    ) {
      callback = node.arguments[2]
      return
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const item of value) visit(item)
      } else {
        visit(value)
      }
    }
  }

  visit(parsed.program)
  assert(callback, `rota ${route} deve existir`)
  return hook.slice(callback.start, callback.end)
}

function localArrayHelper(route) {
  const callback = callbackBlock(route)
  const start = callback.indexOf('function nexoCuradoriaCasosArray(record, field)')
  const end = callback.indexOf('\n\n    function ', start + 1)
  assert(start >= 0 && end > start, `helper local deve existir em ${route}`)
  return vm.runInNewContext(`(${callback.slice(start, end)})`, { Array, JSON, Math, String })
}

function byteCandidate(serialized) {
  const raw = Array.from(Buffer.from(serialized))
  Object.defineProperty(raw, 'toString', { value: () => serialized, enumerable: false })
  return raw
}

function recordReturning(value) {
  return { get: () => value }
}

for (const route of [
  '/backend/v1/nexo/curadoria/casos/listar',
  '/backend/v1/nexo/curadoria/casos/{id}/transicionar',
]) {
  const helper = localArrayHelper(route)

  for (const native of [[91, 93], [123], [0, 255]]) {
    const actual = helper(recordReturning(native), 'campo')
    assert.strictEqual(
      actual,
      native,
      `${route} deve preservar a instância do array nativo ${native}`,
    )
    assert.deepStrictEqual(
      actual,
      native,
      `${route} deve preservar os valores do array nativo ${native}`,
    )
  }

  for (const candidate of [byteCandidate('{"wrong":"type"}'), byteCandidate('[malformed')]) {
    const actual = helper(recordReturning(candidate), 'campo')
    assert.strictEqual(
      actual,
      candidate,
      `${route} deve preservar candidato byte cujo JSON é inválido para o campo array`,
    )
    assert.deepStrictEqual(actual, candidate)
  }

  const bridge = byteCandidate('["whatsapp_uazapi","activecampaign"]')
  const decoded = helper(recordReturning(bridge), 'campo')
  assert.notStrictEqual(decoded, bridge, `${route} deve decodificar JSONRaw real do bridge`)
  assert.deepStrictEqual(Array.from(decoded), ['whatsapp_uazapi', 'activecampaign'])
}

console.log('Curadoria localized array helpers runtime: PASS')
