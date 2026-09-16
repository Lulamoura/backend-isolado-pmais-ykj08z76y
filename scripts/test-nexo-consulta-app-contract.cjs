const fs = require('fs')
const assert = require('assert')

const hook = fs.readFileSync('pocketbase/hooks/com_nexo_central_operacional.js', 'utf8')

assert.match(
  hook,
  /routerAdd\(\s*'POST',\s*'\/backend\/v1\/nexo\/consulta-app'/,
  'Backend deve expor rota técnica POST /backend/v1/nexo/consulta-app para consultas gerenciais do Nexo',
)
assert.match(hook, /nexo_consulta_app_v1/, 'Rota técnica deve declarar contrato estável')
assert.match(hook, /x-pmais-nexo-service-secret|x-pmais-skip-bridge-secret/, 'Rota técnica deve exigir segredo técnico em header')
assert.match(hook, /NEXO_CONSULTA_FORBIDDEN|forbiddenError/, 'Rota técnica deve negar chamada sem credencial técnica')
assert.match(hook, /somente_leitura|read_only/, 'Contrato deve explicitar somente leitura')
assert.match(hook, /sem_mutacao|no_mutation/, 'Contrato deve declarar ausência de mutação')
assert.match(hook, /tipo_consulta/, 'Rota deve aceitar tipo de consulta controlado')
assert.match(hook, /resumo_pipeline/, 'Rota deve suportar resumo gerencial do pipeline')
assert.match(hook, /negocio_por_id/, 'Rota deve suportar consulta por ID humano do negócio')
assert.match(hook, /propostas_sem_retorno/, 'Rota deve suportar consulta de propostas sem retorno')
assert.match(hook, /followups_vencidos/, 'Rota deve suportar consulta de follow-ups vencidos')
assert.match(hook, /aprendizados_comerciais/, 'Rota deve suportar leitura de aprendizados comerciais')
assert.doesNotMatch(hook, /consulta-app[\s\S]{0,4000}\.(save|delete|dao\(\)\.save|dao\(\)\.delete)\(/, 'Rota técnica não pode salvar ou excluir registros')
assert.doesNotMatch(hook, /consulta-app[\s\S]{0,4000}\$http\.send/, 'Rota técnica não deve chamar sistemas externos')
assert.doesNotMatch(hook, /consulta-app[\s\S]{0,4000}findRecordsByFilter\([^,]+,[^,]+,[^,]+,\s*5000/, 'Rota técnica deve ter limite conservador de leitura')

console.log('nexo-consulta-app contract: PASS')
