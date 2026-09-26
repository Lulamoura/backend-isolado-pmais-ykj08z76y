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
const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8')
const nav = fs.readFileSync(path.join(root, 'src/lib/navigation.ts'), 'utf8')
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
  'status retorna último webhook e última mensagem',
  hook.includes('ultimo_webhook') && hook.includes('ultima_mensagem'),
)
assert(
  'status retorna políticas da fase sem automação',
  hook.includes('sem_automacao_livre') && hook.includes('transcricao_apenas'),
)
assert(
  'status retorna roteiro de próximos passos sem telefone',
  hook.includes('simulacao_controlada') && hook.includes('vinculo_negocio_pendente'),
)
assert(
  'mídia de áudio tem política de transcrição apenas',
  hook.includes("retencao_politica', data.retencaoPolitica") &&
    hook.includes("transcricao_status', data.transcricaoStatus"),
)
assert(
  'migration cria campos de transcrição e retenção',
  migration.includes("name: 'retencao_politica'") &&
    migration.includes("name: 'transcricao_status'") &&
    migration.includes("name: 'transcricao_texto'"),
)
assert(
  'migration cria vínculos WhatsApp para etapa negócio',
  migration.includes("'com_whatsapp_vinculos'") &&
    migration.includes("name: 'negocio_id'") &&
    migration.includes('idx_com_whatsapp_vinculos_chat'),
)
assert(
  'serviço chama status Uazapi',
  service.includes('/backend/v1/integracao/whatsapp/uazapi/status'),
)
assert(
  'página exibe monitoramento Uazapi',
  page.includes('Integração WhatsApp') && page.includes('Sem envio automático'),
)
assert(
  'página não expõe roteiro de projeto no frontend',
  !page.includes('Próximas etapas desta fase') && !page.includes('Itens que podem avançar'),
)
assert('rota do app existe', app.includes('path="/integracoes/whatsapp"'))
const mainModulesBlock = nav.slice(
  nav.indexOf('export const MAIN_MODULES'),
  nav.indexOf('export const PIPELINE_PATHS'),
)
const adminTabsBlock = nav.slice(
  nav.indexOf('export const ADMIN_TABS'),
  nav.indexOf('export function modulePathFor'),
)
assert(
  'WhatsApp Comercial fica na Administração',
  adminTabsBlock.includes("{ label: 'WhatsApp Comercial', path: '/integracoes/whatsapp'") &&
    nav.includes("ADMIN_PATHS = ['/foundation', '/slas', '/substituicoes', '/integracoes/whatsapp']") &&
    !mainModulesBlock.includes('WhatsApp Comercial'),
)

console.log('Contrato de próximas etapas Uazapi validado')
