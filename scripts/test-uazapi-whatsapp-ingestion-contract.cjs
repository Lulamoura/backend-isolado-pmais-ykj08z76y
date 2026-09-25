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

function assert(name, cond, detail = '') {
  if (!cond) {
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`)
    process.exit(1)
  }
  console.log(`OK ${name}`)
}

assert(
  'rota webhook com segredo no path',
  hook.includes('/backend/v1/integracao/whatsapp/uazapi/{webhookSecret}/webhook'),
)
assert(
  'rota status autenticada existe',
  hook.includes('/backend/v1/integracao/whatsapp/uazapi/status'),
)
assert('usa secret UAZAPI_WEBHOOK_SECRET', hook.includes("$secrets.get('UAZAPI_WEBHOOK_SECRET')"))
assert('falha fechada sem secret configurado', hook.includes('WEBHOOK_NAO_CONFIGURADO'))
assert('bloqueia secret divergente', hook.includes('WEBHOOK_NAO_AUTORIZADO'))
assert('body limit de 5MB', hook.includes('$apis.bodyLimit(5 * 1024 * 1024)'))
assert('redige token', hook.includes("'token'"))
assert('redige URL temporária', hook.includes("'url'"))
assert('redige mediaKey', hook.includes("'mediakey'"))
assert('não imprime payload no log', !/console\.log|print\(/.test(hook))
assert('persiste evento sanitizado', hook.includes('payload_sanitizado'))
assert('deduplica evento por idempotency_key', hook.includes('idempotencyKey'))
assert('deduplica mensagem por uazapi-message', hook.includes('uazapi-message'))
assert('preserva fromMe', hook.includes('fromMe'))
assert('preserva isGroup e marca grupo ignorado', hook.includes('ignorado_grupo'))
assert(
  'cria pendência de mídia sem download síncrono',
  hook.includes("download_status', data.isGroup ? 'ignorada_grupo' : 'pendente'"),
)
assert('não permite envio automático', hook.includes('automatic_send_allowed: false'))

for (const name of ['com_whatsapp_eventos', 'com_whatsapp_mensagens', 'com_whatsapp_midias']) {
  assert(`migration cria ${name}`, migration.includes(`'${name}'`))
}
assert('índice único eventos', migration.includes('idx_com_whatsapp_eventos_idem'))
assert('índice único mensagens', migration.includes('idx_com_whatsapp_mensagens_idem'))
assert('índice único mídias por message_id', migration.includes('idx_com_whatsapp_midias_message'))
assert(
  'payload sanitizado com limite amplo',
  migration.includes("name: 'payload_sanitizado'") && migration.includes('max: 50000'),
)

const forbidden = ['fromMeYes', 'wasSentByApi'].filter((term) => hook.includes(`'${term}'`))
assert('não exclui mensagens da operadora por padrão', forbidden.length === 0, forbidden.join(','))

console.log('Contrato Uazapi WhatsApp PMais validado')
