const fs = require('node:fs')
const vm = require('node:vm')
const assert = require('node:assert/strict')

const hook = fs.readFileSync('pocketbase/hooks/com_propostas_operacao.js', 'utf8')

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`)
  assert.notEqual(start, -1, `${name} deve existir`)
  const brace = source.indexOf('{', start)
  let depth = 0
  let quote = ''
  let escaped = false
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i]
    if (quote) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === quote) quote = ''
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '{') depth += 1
    if (ch === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  throw new Error(`função ${name} não termina`)
}

const sandbox = {
  contextoSeguro: { whatsapp_contexto: { status: 'indisponivel' } },
  externalId: 'neg-42',
  acao: 'proximo_follow_up',
  nexoWhatsappTemEvidencia: () => false,
  nexoLimparTextoAjuda: (value) => String(value || ''),
  nexoArrayTextos: (value, fallback) =>
    Array.isArray(value) ? value : value ? [String(value)] : fallback ? [fallback] : [],
  nexoBooleanoCuradoria: (value) => Boolean(value),
  nexoNormalizarAvaliacaoCuradoria: (value) => value || null,
  Date: { now: () => 123 },
}
vm.createContext(sandbox)
vm.runInContext(`${extractFunction(hook, 'nexoRespostaGatewayParaContrato')}; this.adaptar = nexoRespostaGatewayParaContrato`, sandbox)

const gatewayResponse = process.env.GATEWAY_RESPONSE_JSON
  ? JSON.parse(process.env.GATEWAY_RESPONSE_JSON)
  : {
      ok: true,
      contract_version: 'pmais_agent_gateway_nexo_ajuda_v1',
      provider: 'pmais_agent_gateway',
      nexo_provider: 'openai_chat',
      fallback: true,
      modelo: 'gpt-real',
      resposta_curta: 'Resposta real',
      diagnostico: 'Diagnóstico real',
      recomendacao: 'Recomendação real e distinta do próximo passo',
      perguntas_de_avanco: ['Pergunta real?'],
      riscos: ['Risco real'],
      proximos_passos: ['Passo real'],
      mensagem_sugerida: 'Mensagem real',
      second_brain: { used: true, sha256: 'abc' },
    }
const adapted = sandbox.adaptar(gatewayResponse)
assert.equal(adapted.resposta_curta, gatewayResponse.resposta_curta)
assert.equal(adapted.diagnostico, gatewayResponse.diagnostico)
assert.equal(adapted.recomendacao, gatewayResponse.recomendacao)
assert.deepEqual(
  Array.from(adapted.perguntas_criticas),
  gatewayResponse.perguntas_de_avanco || gatewayResponse.perguntas_criticas,
)
assert.equal(adapted.provider, gatewayResponse.nexo_provider)
assert.equal(adapted.gateway_provider, gatewayResponse.provider)
assert.equal(
  adapted.modelo,
  gatewayResponse.modelo || gatewayResponse.model_routing.selected_model,
)
assert.equal(adapted.fallback, gatewayResponse.fallback)

for (const invalid of [
  { ...gatewayResponse, ok: false },
  { ...gatewayResponse, contract_version: 'versao-errada' },
  { ...gatewayResponse, provider: '' },
  { ...gatewayResponse, provider: 'fornecedor-inesperado' },
  { ...gatewayResponse, nexo_provider: '' },
  { ...gatewayResponse, nexo_provider: 'backend-inesperado' },
  { ...gatewayResponse, fallback: 'false' },
  { ...gatewayResponse, modelo: { nao: 'string' } },
]) {
  assert.throws(() => sandbox.adaptar(invalid), /GATEWAY_CONTRACT_INVALID/)
}

const dispatch = hook.slice(hook.indexOf('var pmaisGatewayResponse ='), hook.indexOf('var gatewayKey =', hook.indexOf('var pmaisGatewayResponse =')))
assert.match(dispatch, /statusCode >= 200 && pmaisGatewayResponse\.statusCode < 300/)
assert.match(dispatch, /nexoRespostaGatewayParaContrato\(pmaisGatewayResponse\.json \|\| \{\}\)/)

console.log('nexo gateway response integration: PASS')
