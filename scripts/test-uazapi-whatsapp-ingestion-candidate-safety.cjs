const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const raiz = path.resolve(__dirname, '..')
const hook = fs.readFileSync(
  path.join(raiz, 'pocketbase/hooks/com_whatsapp_uazapi_webhook.js'),
  'utf8',
)
const inicio = hook.indexOf('    function carregarRegistros(tx, collectionName, filter, sort)')
const fim = hook.indexOf('    function resumoNegocio(record)', inicio)
if (inicio < 0 || fim < 0) throw new Error('FAIL funções de descoberta comercial não encontradas')

const trecho = hook.slice(inicio, fim)
const funcoes = vm.runInNewContext(
  `(function () {
${trecho}
    return { buscarNegociosParaVinculo: buscarNegociosParaVinculo }
  })()`,
  {
    pbFilterEscape(value) {
      return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
    },
  },
)

class MockRecord {
  constructor(id, fields) {
    this.id = id
    this.fields = fields
  }
  getString(name) {
    return String(this.fields[name] || '')
  }
  getBool(name) {
    return Boolean(this.fields[name])
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL ${message}`)
  console.log(`PASS ${message}`)
}

const contato = new MockRecord('contato-1', { empresa_id: '' })
const candidatos = Array.from(
  { length: 501 },
  (_, index) =>
    new MockRecord(`negocio-${index}`, {
      resultado: index === 0 || index === 500 ? '' : 'ganho',
      inativo: false,
    }),
)
const offsets = []
const txPaginado = {
  findRecordsByFilter(collection, _filter, _sort, limit, offset) {
    if (collection !== 'com_negocios') return []
    offsets.push(offset)
    return candidatos.slice(offset, offset + limit)
  },
}
const resultado = funcoes.buscarNegociosParaVinculo(txPaginado, contato, '')
assert(resultado.abertos.length === 2, 'encontra negócio aberto depois dos primeiros 500 registros')
assert(
  resultado.abertos.some((item) => item.id === 'negocio-500'),
  'não transforma resultado parcial em vínculo automático inequívoco',
)
assert(
  JSON.stringify(offsets) === JSON.stringify([0, 500]),
  'pagina candidatos até esgotar a consulta',
)

const txFalha = {
  findRecordsByFilter() {
    throw new Error('falha simulada na consulta de candidatos')
  },
}
let falhouFechado = false
try {
  funcoes.buscarNegociosParaVinculo(txFalha, contato, '')
} catch (error) {
  falhouFechado = /falha simulada/.test(String(error && error.message))
}
assert(falhouFechado, 'propaga falha de consulta e impede decisão automática com dados incompletos')
