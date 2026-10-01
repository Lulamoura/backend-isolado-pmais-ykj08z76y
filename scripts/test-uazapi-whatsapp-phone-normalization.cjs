const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const raiz = path.resolve(__dirname, '..')
const hook = fs.readFileSync(
  path.join(raiz, 'pocketbase/hooks/com_whatsapp_uazapi_webhook.js'),
  'utf8',
)

function extrairFuncoes(inicioTexto, fimTexto, retorno) {
  const inicio = hook.indexOf(inicioTexto)
  const fim = hook.indexOf(fimTexto, inicio)
  if (inicio < 0 || fim < 0) throw new Error(`FAIL trecho não encontrado: ${inicioTexto}`)
  return vm.runInNewContext(
    `(function () {
      function asString(value) {
        if (value === null || value === undefined) return ''
        return String(value)
      }
${hook.slice(inicio, fim)}
      return ${retorno}
    })()`,
  )
}

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL ${message}`)
  console.log(`PASS ${message}`)
}

const telefone = extrairFuncoes(
  '    function normalizePhone(value)',
  '    function carregarRegistros(tx, collectionName, filter, sort)',
  '{ normalizePhone, samePhone }',
)

assert(
  telefone.samePhone('558184002452', '(81) 98400-2452'),
  'reconhece telefone brasileiro do WhatsApp sem o nono dígito como o mesmo contato do CRM',
)
assert(
  telefone.samePhone('55 81 98400-2452', '(81) 98400-2452'),
  'aceita a presença opcional do código do país',
)
assert(
  !telefone.samePhone('558184002452', '(85) 8400-2452'),
  'não associa números iguais em DDDs diferentes',
)
assert(
  !telefone.samePhone('558184002452', '8400-2452'),
  'não associa usando somente os oito últimos dígitos sem DDD',
)
assert(
  !telefone.samePhone('8400-2452', '8400-2452'),
  'rejeita até números idênticos quando ambos estão sem DDD',
)
assert(
  !telefone.samePhone('558132345678', '(81) 93234-5678'),
  'não transforma telefone fixo em celular ao inserir o nono dígito',
)

const conversas = extrairFuncoes(
  '  function incrementarConversaUnica(',
  '  function valoresOrdenados(map, limite)',
  '{ incrementarConversaUnica }',
)
const vistos = {}
const item = { total_conversas: 0 }
assert(
  conversas.incrementarConversaUnica(item, vistos, 'Viviane PMais', 'uazapi|instancia|dona|chat-1'),
  'conta a primeira mensagem de uma conversa',
)
assert(
  !conversas.incrementarConversaUnica(
    item,
    vistos,
    'Viviane PMais',
    'uazapi|instancia|dona|chat-1',
  ),
  'não conta duas vezes mensagens da mesma conversa',
)
assert(
  conversas.incrementarConversaUnica(item, vistos, 'Viviane PMais', 'uazapi|instancia|dona|chat-2'),
  'conta uma segunda conversa distinta',
)
assert(item.total_conversas === 2, 'mantém o total de conversas distintas por operador')

console.log('Normalização brasileira e volume por conversa validados')
