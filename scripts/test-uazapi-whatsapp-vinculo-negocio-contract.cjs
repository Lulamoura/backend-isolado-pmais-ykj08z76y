const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const hook = fs.readFileSync(
  path.join(root, 'pocketbase/hooks/com_whatsapp_uazapi_webhook.js'),
  'utf8',
)
const migration = fs.readFileSync(
  path.join(root, 'pocketbase/migrations/202609251030_uazapi_whatsapp_ingestion.js'),
  'utf8',
)
const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8')

function assert(name, cond, detail = '') {
  if (!cond) {
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`)
    process.exit(1)
  }
  console.log(`OK ${name}`)
}

assert(
  'hook normaliza telefone do chat WhatsApp sem expor JID técnico',
  hook.includes('function normalizePhone') && hook.includes('telefoneFromChat'),
)
assert(
  'hook busca contato comercial por telefone normalizado',
  hook.includes('function buscarContatosPorTelefone') &&
    hook.includes("tx.findRecordsByFilter('com_contatos'") &&
    hook.includes("record.getString('telefone')"),
)
assert(
  'hook busca negócios por contato e empresa separando abertos de fechados',
  hook.includes('function buscarNegociosParaVinculo') &&
    hook.includes("contato_principal_id='") &&
    hook.includes("empresa_id='") &&
    hook.includes('negociosAbertos') &&
    hook.includes('negociosFechados'),
)
assert(
  'hook decide vínculo automático somente com um negócio aberto inequívoco',
  hook.includes("status = 'vinculado_automatico'") &&
    hook.includes("status = 'ambiguidade_negocio_aberto'") &&
    hook.includes("status = 'sem_correspondencia'") &&
    hook.includes('negociosAbertos.length === 1'),
)
assert(
  'negócio aberto tem prioridade sobre ganho/perdido e fechados ficam secundários',
  hook.includes('Negócio aberto tem prioridade sobre ganho/perdido') &&
    hook.includes('sistema_sem_negocio_aberto_fechados_secundarios') &&
    hook.includes('Negócios ganhos/perdidos encontrados apenas como referência secundária'),
)
assert(
  'múltiplos negócios abertos entram no piloto Nexo Telegram com operador e candidatos',
  hook.includes('PILOTO_NEXO_TELEGRAM') &&
    hook.includes('sistema_multiplos_negocios_abertos_piloto_nexo_telegram') &&
    hook.includes('resumoNegocios(negociosAbertos)') &&
    hook.includes('ambiguidades_negocios_abertos'),
)
assert(
  'hook persiste/atualiza com_whatsapp_vinculos a cada mensagem privada',
  hook.includes('function resolverVinculoComercial') &&
    hook.includes("com_whatsapp_vinculos") &&
    hook.includes("last_message_at") &&
    hook.includes("origem_decisao"),
)
assert(
  'ledger recebe contato empresa e negócio quando houver vínculo',
  hook.includes('data.vinculoComercial') &&
    /record\.set\(\s*'empresa_nome'/m.test(hook) &&
    /record\.set\(\s*'negocio_ref'/m.test(hook),
)
assert(
  'grupos não geram vínculo comercial',
  hook.includes('if (data.isGroup || !data.chatId) return null'),
)
assert(
  'migration mantém campos de vínculo necessários',
  migration.includes("name: 'telefone'") &&
    migration.includes("name: 'contato_id'") &&
    migration.includes("name: 'empresa_id'") &&
    migration.includes("name: 'negocio_id'") &&
    migration.includes('idx_com_whatsapp_vinculos_negocio'),
)
assert(
  'contrato de vínculo roda no gate Uazapi',
  pkg.includes('test-uazapi-whatsapp-vinculo-negocio-contract.cjs'),
)

console.log('Contrato de vínculo WhatsApp → contato/empresa/negócio validado')
