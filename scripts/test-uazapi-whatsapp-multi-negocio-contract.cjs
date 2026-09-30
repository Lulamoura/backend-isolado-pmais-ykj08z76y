const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const hook = fs.readFileSync(
  path.join(root, 'pocketbase/hooks/com_whatsapp_uazapi_webhook.js'),
  'utf8',
)
const migrationPath = path.join(
  root,
  'pocketbase/migrations/202609302330_whatsapp_multi_negocio.js',
)
const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : ''
const schema = JSON.parse(
  fs.readFileSync(path.join(root, 'src/lib/pocketbase/schema.json'), 'utf8'),
)

function assert(name, cond) {
  if (!cond) {
    console.error(`FAIL ${name}`)
    process.exit(1)
  }
  console.log(`OK ${name}`)
}

const vinculos = schema.collections.find(
  (collection) => collection.name === 'com_whatsapp_vinculos',
)
const negocioIdsField = vinculos?.fields.find((field) => field.name === 'negocio_ids')
const inicioPreservacao = hook.indexOf(
  "if (statusExistente === 'vinculado_multiplo' && negocioIdsExistentes.length > 1)",
)
const fimPreservacao = hook.indexOf('if (!vinculo) vinculo = new Record', inicioPreservacao)
const ramoPreservacao = hook.slice(inicioPreservacao, fimPreservacao)

assert(
  'schema aceita vários negócios no mesmo diálogo',
  negocioIdsField?.type === 'json' && negocioIdsField?.required === false,
)
assert(
  'migração cria o campo de múltiplos negócios quando getByName retorna nulo',
  migration.includes("var campoNegocioIds = collection.fields.getByName('negocio_ids')") &&
    migration.includes('if (!campoNegocioIds)') &&
    migration.includes("name: 'negocio_ids'") &&
    migration.includes('new JSONField(') &&
    hook.includes("if (!existente.fields.getByName('negocio_ids'))"),
)
assert(
  'migração vincula o caso autorizado aos dois negócios somente no estado esperado',
  migration.includes("'9ktk4n5hvxiwx4p'") &&
    migration.includes("'q3g119zt7r9g0tv'") &&
    migration.includes("'mgic724qec8mz20'") &&
    migration.includes("'vinculado_multiplo'") &&
    migration.includes("'decisao_humana_dialogo_multiplos_negocios'") &&
    migration.includes("vinculo.getString('status') !== 'ambiguidade_negocio_aberto'") &&
    migration.includes("vinculo.getString('negocio_id') !== ''"),
)
assert(
  'rollback restaura somente o estado exato criado pela migração e preserva o campo',
  migration.includes("vinculo.set('status', 'ambiguidade_negocio_aberto')") &&
    migration.includes("vinculo.set('observacao', OBSERVACAO_ANTERIOR)") &&
    migration.includes("vinculo.getString('observacao') !== OBSERVACAO_NOVA") &&
    migration.includes("idsAtuais.indexOf('q3g119zt7r9g0tv') === -1") &&
    migration.includes("idsAtuais.indexOf('mgic724qec8mz20') === -1") &&
    !migration.includes("collection.fields.removeByName('negocio_ids')"),
)
assert(
  'novas mensagens preservam vínculo múltiplo e seu contexto comercial',
  hook.includes('function negocioIdsDoVinculo') &&
    hook.includes("statusExistente === 'vinculado_multiplo'") &&
    hook.includes('negocioIdsExistentes.length > 1') &&
    hook.includes('negocioIds: negocioIdsExistentes') &&
    ramoPreservacao.includes("vinculo.set('last_message_at'") &&
    !ramoPreservacao.includes("vinculo.set('contato_id'") &&
    !ramoPreservacao.includes("vinculo.set('empresa_id'") &&
    !ramoPreservacao.includes("vinculo.set('negocio_ids'") &&
    !ramoPreservacao.includes("vinculo.set('origem_decisao'") &&
    !ramoPreservacao.includes("vinculo.set('observacao'") &&
    !ramoPreservacao.includes("vinculo.set('vinculado_em'"),
)
assert(
  'ledger registra todos os negócios associados ao diálogo',
  hook.includes('resumoNegociosPorIds') &&
    hook.includes('data.vinculoComercial.negocioIds') &&
    hook.includes(".join('; ')"),
)
assert(
  'qualidade considera vínculo múltiplo como resolvido e usa identidade completa da conversa',
  hook.includes("status === 'vinculado_multiplo'") &&
    hook.includes('idsVinculados.length > 0') &&
    hook.includes('function chaveVinculo(record)') &&
    hook.includes("record.getString('provider')") &&
    hook.includes("record.getString('instance_name')") &&
    hook.includes("record.getString('owner')") &&
    hook.includes("record.getString('chat_id')") &&
    hook.includes('vinculoPorConversa[chaveVinculo(msg)]'),
)
assert(
  'replay não altera vínculo, mensagem, mídia ou ledger',
  hook.includes('if (eventResult.replay) return'),
)
assert(
  'referência dos negócios respeita o limite do ledger',
  hook.includes("record.set('negocio_ref', truncate(negocioRef, 240))"),
)

console.log('Contrato de vínculo de um diálogo a múltiplos negócios validado')
