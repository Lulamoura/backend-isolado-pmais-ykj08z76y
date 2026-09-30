const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const hook = fs.readFileSync(
  path.join(root, 'pocketbase/hooks/com_whatsapp_uazapi_webhook.js'),
  'utf8',
)
const recoveryMigrationPath = path.join(
  root,
  'pocketbase/migrations/202609301900_whatsapp_capture_recovery.js',
)
const recoveryMigration = fs.existsSync(recoveryMigrationPath)
  ? fs.readFileSync(recoveryMigrationPath, 'utf8')
  : ''
const service = fs.readFileSync(path.join(root, 'src/services/whatsapp-uazapi.ts'), 'utf8')
const page = fs.readFileSync(path.join(root, 'src/pages/WhatsAppUazapi.tsx'), 'utf8')

function assert(name, cond, detail = '') {
  if (!cond) {
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`)
    process.exit(1)
  }
  console.log(`OK ${name}`)
}

assert(
  'migração corretiva cria a coleção de vínculos mesmo quando a migração inicial já foi aplicada',
  recoveryMigration.includes("'com_whatsapp_vinculos'") &&
    recoveryMigration.includes("name: 'last_message_at'") &&
    recoveryMigration.includes('idx_com_whatsapp_vinculos_chat'),
)
assert(
  'hook garante a coleção de vínculos antes de processar mensagens',
  hook.includes('function garantirColecaoVinculos') &&
    hook.includes('garantirColecaoVinculos($app)'),
)
assert(
  'busca de vínculo usa campo existente da coleção',
  /findRecordsByFilter\(\s*'com_whatsapp_vinculos',\s*filter,\s*'-last_message_at',\s*1,\s*0,?\s*\)/m.test(
    hook,
  ) && !hook.includes("findRecordsByFilter('com_whatsapp_vinculos', filter, '-updated', 1, 0)"),
)
assert(
  'contagem de hoje usa início do dia em Recife e nomes coerentes',
  hook.includes('function inicioDiaRecifeUtc') &&
    hook.includes('inicioHojeRecife') &&
    hook.includes('eventos_hoje') &&
    hook.includes('mensagens_hoje') &&
    !hook.includes('@todayStart') &&
    page.includes('counts?.eventos_hoje ?? counts?.eventos_24h') &&
    page.includes('counts?.mensagens_hoje ?? counts?.mensagens_24h'),
)
assert(
  'qualidade da base pagina todos os registros com ordenação estável',
  hook.includes('function carregarRegistros') &&
    hook.includes('mensagens = carregarRegistros(') &&
    hook.includes('vinculos = carregarRegistros(') &&
    hook.includes('midiasPendentes = carregarRegistros(') &&
    hook.includes("'-message_at,-received_at,-id'") &&
    hook.includes("'-last_message_at,-id'") &&
    hook.includes("'-received_at,-id'") &&
    !hook.includes("'-message_at,-created'") &&
    !hook.includes("'-last_message_at,-updated'") &&
    !hook.includes("'-received_at,-created'"),
)
assert(
  'contadores pendentes não usam created nas coleções WhatsApp',
  !hook.includes('' + "'-created'"),
)
assert(
  'API sinaliza quando alguma leitura do monitoramento falha',
  hook.includes('function firstRecord(collectionName, filter, sort, failureCode)') &&
    hook.includes("registrarFalha(failureCode || 'ultima_leitura')") &&
    /firstRecord\([\s\S]{0,100}'ultimo_webhook'\)/m.test(hook) &&
    /firstRecord\([\s\S]{0,100}'ultima_mensagem'\)/m.test(hook) &&
    /firstRecord\([\s\S]{0,100}'ultima_midia'\)/m.test(hook),
)
assert(
  'últimas interações usam received_at como fallback existente',
  hook.includes("safeDate(msg, 'message_at') || safeDate(msg, 'received_at')") &&
    !hook.includes("safeDate(msg, 'message_at') || safeDate(msg, 'created')"),
)
assert(
  'contadores não ficam limitados silenciosamente aos primeiros 500 registros',
  hook.includes('function contarRegistros') &&
    hook.includes('counts.eventos_hoje = contarRegistros(') &&
    hook.includes('counts.mensagens_hoje = contarRegistros('),
)
assert(
  'frontend trata contrato novo como opcional e ausência de saúde como estado parcial',
  service.includes('monitoramento_ok?: boolean') &&
    service.includes('fontes_indisponiveis?: string[]') &&
    page.includes('Dados parciais no monitoramento') &&
    page.includes('status && status.monitoramento_ok !== true'),
)

console.log('Contrato de recuperação da captura WhatsApp validado')
