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

console.log('Curadoria hook materialization contract: PASS')
