const fs = require('node:fs')
const assert = require('node:assert/strict')

const hook = fs.readFileSync('pocketbase/hooks/com_propostas_operacao.js', 'utf8')

assert.match(
  hook,
  /GET[\s\S]*\/backend\/v1\/nexo\/diagnostico\/pmais-gateway-env/,
  'backend deve expor rota temporária GET /backend/v1/nexo/diagnostico/pmais-gateway-env',
)
assert.match(hook, /presente/, 'diagnóstico deve retornar campo booleano presente')
assert.match(
  hook,
  /PMAIS_AGENT_GATEWAY_URL/,
  'diagnóstico deve verificar presença de PMAIS_AGENT_GATEWAY_URL',
)
assert.match(
  hook,
  /PMAIS_AGENT_GATEWAY_API_KEY/,
  'diagnóstico deve verificar presença de PMAIS_AGENT_GATEWAY_API_KEY',
)
assert.match(
  hook,
  /PMAIS_AGENT_GATEWAY_HMAC_SECRET/,
  'diagnóstico deve verificar presença de PMAIS_AGENT_GATEWAY_HMAC_SECRET',
)
assert.match(
  hook,
  /valor_exposto:\s*false|values_exposed:\s*false/,
  'diagnóstico deve declarar que não expõe valores',
)
assert.doesNotMatch(
  hook,
  /PMAIS_AGENT_GATEWAY_API_KEY[^\n]{0,80}\+|PMAIS_AGENT_GATEWAY_HMAC_SECRET[^\n]{0,80}\+/,
  'diagnóstico não deve concatenar valores de API key ou HMAC na resposta',
)

console.log('nexo-pmais-gateway-env-diagnostic contract: PASS')
