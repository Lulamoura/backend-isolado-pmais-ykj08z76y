const fs = require('node:fs')
const assert = require('node:assert/strict')

const hookPath = 'pocketbase/hooks/com_propostas_operacao.js'
assert.ok(fs.existsSync(hookPath), 'hook com_propostas_operacao.js deve existir')

const hook = fs.readFileSync(hookPath, 'utf8')

assert.match(
  hook,
  /routerAdd\(\s*'GET',\s*'\/backend\/v1\/nexo\/negocios\/\{externalId\}\/contexto'/,
  'deve expor endpoint consolidado por ID externo do negócio',
)
assert.match(hook, /\$apis\.requireAuth\('users'\)/, 'endpoint deve exigir autenticação de usuário')
assert.match(hook, /ativo_comercial/, 'endpoint deve exigir usuário comercial ativo')
assert.match(
  hook,
  /nexoPodeAcessarNegocio/,
  'endpoint deve validar escopo do negócio antes de retornar contexto',
)
assert.match(hook, /propostaSubstituicaoAutoriza/, 'endpoint deve respeitar substituições vigentes')
assert.match(
  hook,
  /sistema_origem='activecampaign' && external_type='business' && external_id='/,
  'endpoint deve localizar o negócio pelo vínculo ActiveCampaign business/external_id',
)
assert.match(hook, /AC_API_URL/, 'endpoint deve usar segredo AC_API_URL, sem expor valor')
assert.match(hook, /AC_API_KEY/, 'endpoint deve usar segredo AC_API_KEY, sem expor valor')
assert.doesNotMatch(
  hook,
  /Api-Token['"]\s*:\s*['"][^'"]+['"]/,
  'não pode haver token ActiveCampaign literal',
)
assert.match(hook, /\/api\/3\/deals\//, 'deve ler o deal no ActiveCampaign')
assert.match(hook, /\/api\/3\/dealCustomFieldMeta/, 'deve ler metadados dos campos de negócio')
assert.match(
  hook,
  /filters\[dealId\]/,
  'deve buscar valores customizados por filters[dealId], não filters[deal]',
)
assert.doesNotMatch(hook, /filters\[deal\]=/, 'não deve usar filtro inválido filters[deal]')
assert.match(hook, /Detalhamento da Proposta/, 'deve reconhecer o campo Detalhamento da Proposta')
assert.match(hook, /Tipo de Serviço/, 'deve reconhecer o campo Tipo de Serviço')
assert.match(hook, /descricao_negocio/, 'deve devolver Descrição do Negócio como fonte separada')
assert.match(
  hook,
  /detalhamento_proposta/,
  'deve devolver Detalhamento da Proposta como fonte separada',
)
assert.match(hook, /tipo_servico/, 'deve devolver Tipo de Serviço como fonte separada')
assert.match(hook, /\/api\/3\/notes/, 'deve buscar notas/follow-ups do ActiveCampaign')
assert.match(hook, /reltype.*Deal|Deal.*reltype/, 'deve filtrar notas de negócio/deal')
assert.match(hook, /com_propostas/, 'deve incluir proposta local do aplicativo')
assert.match(hook, /com_proposta_versoes/, 'deve incluir versão/PDF da proposta')
assert.match(hook, /arquivo_sha256/, 'deve incluir hash/evidência do PDF')
assert.match(hook, /fontes/, 'resposta deve declarar fontes usadas para o Nexo')
assert.match(hook, /nexo_contexto_negocio_v1/, 'resposta deve ter versão de contrato estável')

console.log('nexo-contexto-negocio contract: PASS')
