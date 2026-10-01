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
const moduleTabs = fs.readFileSync(path.join(root, 'src/components/ModuleTabs.tsx'), 'utf8')

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
  'status expõe qualidade da base WhatsApp Comercial para decisão Nexo',
  hook.includes('qualidade_base') &&
    hook.includes('aproveitamento_nexo_percentual') &&
    hook.includes('por_operador') &&
    hook.includes('negocios_com_conversas_recentes') &&
    hook.includes('sinais_comerciais_iniciais'),
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
  'página exibe monitoramento Uazapi e fila de ambiguidades sem alertas removidos',
  page.includes('Integração WhatsApp') &&
    page.includes('Ambiguidades para decisão') &&
    page.includes('Confirmar vínculo') &&
    !page.includes('Sem envio automático') &&
    !page.includes('Dados parciais no monitoramento'),
)
assert(
  'página evolui para Qualidade da base WhatsApp Comercial',
  page.includes('Qualidade da base WhatsApp Comercial') &&
    page.includes('Aproveitamento para o Nexo') &&
    page.includes('Por operador') &&
    page.includes('Negócios com conversas recentes') &&
    page.includes('Sinais comerciais iniciais'),
)
assert(
  'página humaniza datas e remove exposição de campos técnicos',
  page.includes('formatarDataHoraRecife') &&
    page.includes('horário de Recife') &&
    page.includes('ResumoOperacional') &&
    page.includes('com negócio identificado') &&
    page.includes('aguardando vínculo') &&
    !page.includes('ResumoTecnico') &&
    !page.includes('Object.entries(dados)') &&
    !page.includes("key.replace(/_/g, ' ')"),
)
assert(
  'página filtra sondas técnicas da lista de operadores',
  page.includes('ehOperadorComercial') && page.includes('operadoresComerciais'),
)
assert(
  'página não expõe roteiro de projeto no frontend',
  !page.includes('Próximas etapas desta fase') && !page.includes('Itens que podem avançar'),
)
assert('rota do app existe', app.includes('path="/integracoes/whatsapp"'))
assert(
  'fila de ambiguidades fica restrita a perfis humanos autorizados também no frontend',
  app.includes('WhatsAppAdministrationRoute') &&
    app.includes("new Set(['superadministrador', 'gestor-comercial'])") &&
    moduleTabs.includes("item.path !== '/integracoes/whatsapp'") &&
    !app.includes("WHATSAPP_ADMIN_ALLOWLIST = new Set(['integracao'"),
)
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
    nav.includes(
      "ADMIN_PATHS = ['/foundation', '/slas', '/substituicoes', '/integracoes/whatsapp']",
    ) &&
    !mainModulesBlock.includes('WhatsApp Comercial'),
)

console.log('Contrato de próximas etapas Uazapi validado')
