const fs = require('fs')
const assert = require('assert')

const hook = fs.readFileSync('pocketbase/hooks/com_nexo_central_operacional.js', 'utf8')
const whatsappStart = hook.indexOf('function consultaAprendizadosWhatsappComercial')
const whatsappEnd = hook.indexOf('function consultaRevisoesIpcpPendentes', whatsappStart)
const whatsappSection = hook.slice(whatsappStart, whatsappEnd)

assert.match(
  hook,
  /routerAdd\(\s*'POST',\s*'\/backend\/v1\/nexo\/consulta-app'/,
  'Backend deve expor rota técnica POST /backend/v1/nexo/consulta-app para consultas gerenciais do Nexo',
)
assert.match(hook, /nexo_consulta_app_v1/, 'Rota técnica deve declarar contrato estável')
assert.match(
  hook,
  /x-pmais-nexo-service-secret|x-pmais-skip-bridge-secret/,
  'Rota técnica deve exigir segredo técnico em header',
)
assert.match(
  hook,
  /NEXO_CONSULTA_FORBIDDEN|forbiddenError/,
  'Rota técnica deve negar chamada sem credencial técnica',
)
assert.match(hook, /somente_leitura|read_only/, 'Contrato deve explicitar somente leitura')
assert.match(hook, /sem_mutacao|no_mutation/, 'Contrato deve declarar ausência de mutação')
assert.match(hook, /tipo_consulta/, 'Rota deve aceitar tipo de consulta controlado')
assert.match(hook, /resumo_pipeline/, 'Rota deve suportar resumo gerencial do pipeline')
assert.match(hook, /negocio_por_id/, 'Rota deve suportar consulta por ID humano do negócio')
assert.match(hook, /propostas_sem_retorno/, 'Rota deve suportar consulta de propostas sem retorno')
assert.match(hook, /followups_vencidos/, 'Rota deve suportar consulta de follow-ups vencidos')
assert.match(
  hook,
  /aprendizados_comerciais/,
  'Rota deve suportar leitura de aprendizados comerciais',
)
assert.match(
  hook,
  /aprendizados_whatsapp_comercial[\s\S]{0,2000}nexo_whatsapp_aprendizados_v1/,
  'Rota deve suportar leitura governada de aprendizados do WhatsApp Comercial',
)
assert.match(
  hook,
  /captura_nao_e_aprendizado/,
  'Consulta WhatsApp deve explicitar que captura não é aprendizado oficial',
)
assert.match(
  hook,
  /nao_promove_conhecimento_sozinho/,
  'Consulta WhatsApp não pode promover conhecimento sozinha',
)
assert.match(
  hook,
  /fatos_observados[\s\S]{0,200}possiveis_aprendizados[\s\S]{0,200}conhecimento_aprovado/,
  'Consulta WhatsApp deve separar fatos, candidatos e conhecimento aprovado',
)
assert.match(
  whatsappSection,
  /whatsapp_evidencia\s*=\s*true/,
  'eventos de curadoria WhatsApp devem ser selecionados por proveniência estrutural',
)
assert.doesNotMatch(
  whatsappSection,
  /fonte_evento|evidencia_resumo/,
  'consulta não pode filtrar decisões por campos inexistentes',
)
assert.match(
  whatsappSection,
  /com_nexo_curadoria_casos/,
  'consulta governada deve ler os casos unificados',
)
assert.match(
  whatsappSection,
  /conhecimento_status\s*=\s*'ativo'/,
  'consulta governada deve restringir conhecimento ao estado ativo',
)
assert.match(
  whatsappSection,
  /conhecimento_audit_id[\s\S]{0,500}conhecimento_versao|conhecimento_versao[\s\S]{0,500}conhecimento_audit_id/,
  'conhecimento ativo deve possuir confirmação de auditoria e versão',
)
assert.doesNotMatch(
  whatsappSection,
  /com_nexo_aprendizado_decisoes/,
  'consulta governada não deve usar o fluxo legado de decisões',
)
assert.doesNotMatch(
  whatsappSection,
  /safeGet\(ev, 'external_id'\)/,
  'consulta governada não deve expor identificador técnico como referência de negócio',
)
assert.match(
  whatsappSection,
  /inconclusivo_fontes_indisponiveis/,
  'consulta deve marcar resultado inconclusivo quando alguma fonte necessária falhar',
)
assert.match(
  hook,
  /ipcp_gerencial/,
  'Rota deve suportar consulta gerencial IPCP para o Nexo Telegram',
)
assert.match(
  hook,
  /nexo_telegram_ipcp_v1/,
  'Consulta IPCP do Nexo Telegram deve declarar contrato próprio versionado',
)
assert.match(
  hook,
  /sem_crm_write[\s\S]{0,300}sem_app_write[\s\S]{0,300}sem_envio|sem_envio[\s\S]{0,300}sem_crm_write[\s\S]{0,300}sem_app_write/,
  'Consulta IPCP deve repetir guardrails: sem CRM write, sem app write e sem envio',
)
assert.match(
  hook,
  /fallback_openai_bloqueado/,
  'Consulta IPCP deve bloquear fallback OpenAI para evidência oficial',
)
assert.match(
  hook,
  /function valorNegocioCentavosConsulta[\s\S]{0,500}rec\.get\('valor'\)/,
  'Consulta Nexo deve ler o campo canônico valor de com_negocios, não um campo inexistente valor_centavos',
)
assert.match(
  hook,
  /valor_centavos:\s*valorNegocioCentavosConsulta\(n\)/,
  'Resumo de negócio para o Nexo deve expor valor_centavos derivado de com_negocios.valor',
)
assert.doesNotMatch(
  hook,
  /id_negocio:\s*oeNumero\s*\|\|\s*external\s*\|\|\s*n\.id/,
  'Consulta Nexo não deve usar ID técnico PocketBase como número do negócio',
)
assert.doesNotMatch(
  hook,
  /consulta-app[\s\S]{0,4000}\.(save|delete|dao\(\)\.save|dao\(\)\.delete)\(/,
  'Rota técnica não pode salvar ou excluir registros',
)
assert.doesNotMatch(
  hook,
  /consulta-app[\s\S]{0,4000}\$http\.send/,
  'Rota técnica não deve chamar sistemas externos',
)
assert.doesNotMatch(
  hook,
  /consulta-app[\s\S]{0,4000}findRecordsByFilter\([^,]+,[^,]+,[^,]+,\s*5000/,
  'Rota técnica deve ter limite conservador de leitura',
)

console.log('nexo-consulta-app contract: PASS')
