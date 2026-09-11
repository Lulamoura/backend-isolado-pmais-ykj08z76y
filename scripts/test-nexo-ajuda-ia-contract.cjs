const fs = require('node:fs')
const assert = require('node:assert/strict')

const hookPath = 'pocketbase/hooks/com_propostas_operacao.js'
const servicePath = 'src/services/nexo.ts'
const componentPath = 'src/components/NexoBusinessActions.tsx'

const hook = fs.readFileSync(hookPath, 'utf8')
const service = fs.readFileSync(servicePath, 'utf8')
const component = fs.readFileSync(componentPath, 'utf8')

assert.match(
  hook,
  /POST[\s\S]*\/backend\/v1\/nexo\/negocios\/\{externalId\}\/ajuda/,
  'backend deve expor POST /backend/v1/nexo/negocios/{externalId}/ajuda',
)
assert.match(hook, /nexo_ajuda_comercial_v1/, 'backend deve declarar contrato da ajuda comercial')
assert.match(
  hook,
  /OPENAI_API_KEY|NEXO_OPENAI_API_KEY/,
  'backend deve usar segredo de LLM para IA real',
)
assert.match(hook, /chat\/completions|responses/, 'backend deve chamar API de geração de IA')
assert.match(hook, /SKIP_AI_GATEWAY_URL/, 'backend deve usar o gateway IA nativo do SKIP quando disponível')
assert.match(hook, /\$os\.getenv|nexoEnv/, 'backend deve aceitar variável de ambiente SKIP além de $secrets')
assert.match(
  hook,
  /Sem envio automático|nao_envia_automaticamente|não enviar/i,
  'prompt deve proibir envio automático',
)
assert.match(hook, /Detalhamento da Proposta/, 'prompt deve usar Detalhamento da Proposta')
assert.match(hook, /notas|follow-ups/i, 'prompt deve usar histórico de notas/follow-ups')
assert.match(hook, /dicas_para_melhorar_notas/, 'resposta deve suportar dicas para melhorar notas')
assert.match(hook, /perguntas_criticas/, 'resposta deve suportar perguntas críticas do caso')
assert.match(
  hook,
  /mensagem_sugerida/,
  'resposta deve suportar mensagem de follow-up pronta para revisão',
)

assert.match(
  service,
  /gerarAjudaNexoNegocio[\s\S]*\/backend\/v1\/nexo\/negocios\/\$\{externalId\}\/ajuda[\s\S]*POST/,
  'serviço frontend deve chamar POST de ajuda do Nexo',
)
assert.match(service, /NexoAjudaComercial/, 'serviço deve tipar resposta consultiva do Nexo')

assert.match(component, /Sugerir próximo follow-up/, 'UI deve oferecer ação de follow-up')
assert.match(component, /Preparar WhatsApp/, 'UI deve oferecer ação de WhatsApp')
assert.match(component, /Gerar roteiro de ligação/, 'UI deve oferecer roteiro de ligação')
assert.match(component, /Avaliar risco de perda/, 'UI deve oferecer análise de risco de perda')
assert.match(component, /Dicas para melhorar notas/, 'UI deve oferecer dicas de notas')
assert.match(component, /gerarAjudaNexoNegocio/, 'UI deve chamar geração real do Nexo')
assert.match(component, /Gerar ajuda do Nexo/, 'UI deve ter botão primário de geração')
assert.doesNotMatch(
  component,
  /function gerarAjudaComercial|const perguntas: string\[\] = \[\]/,
  'UI não deve gerar ajuda genérica por regras locais',
)

console.log('nexo-ajuda-ia contract: PASS')
