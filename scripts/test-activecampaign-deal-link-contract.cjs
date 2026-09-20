const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const util = read('src/lib/activecampaign-deal-url.ts')
const hook = read('src/hooks/use-activecampaign-deal-base-url.ts')
const param = read('src/components/foundation/parametros-amigaveis.ts')
const card = read('src/components/ActiveCampaignDealLink.tsx')
const contextCard = read('src/components/CommercialContextCard.tsx')
const negocios = read('src/components/foundation/NegociosTab.tsx')
const ipcp = read('src/components/ipcp/IpcpEducativoDiarioCard.tsx')
const nexo = read('src/pages/NexoAssistente.tsx')
const atividades = read('src/pages/Atividades.tsx')
const qualificacoes = read('src/pages/Qualificacoes.tsx')
const ordensExecucao = read('src/pages/OrdensExecucao.tsx')
const migration = read('pocketbase/migrations/202609201210_activecampaign_deal_base_url_param.js')

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exit(1)
  }
}

assert(
  util.includes("ACTIVE_CAMPAIGN_DEAL_BASE_URL_PARAM = 'activecampaign.deal_base_url'") &&
    util.includes('https://pmaisservicos89463.activehosted.com/app/deals/') &&
    util.includes('buildActiveCampaignDealUrl'),
  'utilitário deve montar URL do negócio ActiveCampaign a partir de parâmetro e ID',
)
assert(
  hook.includes('com_parametros') &&
    hook.includes('ACTIVE_CAMPAIGN_DEAL_BASE_URL_PARAM') &&
    hook.includes('catch'),
  'hook deve ler URL base editável em com_parametros com fallback seguro',
)
assert(
  param.includes("id: 'integracao-activecampaign'") &&
    param.includes("chave: 'activecampaign.deal_base_url'") &&
    param.includes("controle: 'url'"),
  'Administração deve expor URL base do ActiveCampaign como parâmetro editável',
)
assert(
  card.includes('target="_blank"') &&
    card.includes('rel="noopener noreferrer"') &&
    card.includes('Abrir no ActiveCampaign'),
  'link deve abrir ActiveCampaign em nova aba com rótulo operacional',
)
assert(
  contextCard.includes('ActiveCampaignDealLink') && negocios.includes('ActiveCampaignDealLink'),
  'cards/lista principal de negócios devem expor botão ActiveCampaign',
)
assert(
  ipcp.includes('ActiveCampaignDealLink') && nexo.includes('ActiveCampaignDealLink'),
  'cards IPCP e Nexo devem expor atalho ActiveCampaign quando houver ID',
)
assert(
  atividades.includes('ActiveCampaignDealLink') &&
    qualificacoes.includes('ActiveCampaignDealLink') &&
    ordensExecucao.includes('ActiveCampaignDealLink'),
  'cards de Atividades, Qualificação e OE também devem expor atalho ActiveCampaign quando houver ID',
)
assert(
  migration.includes('activecampaign.deal_base_url') &&
    migration.includes('https://pmaisservicos89463.activehosted.com/app/deals/') &&
    migration.includes('url_absoluta_https') &&
    migration.includes("record.set('versao', 1)"),
  'migration deve materializar parâmetro padrão da URL base ActiveCampaign',
)

console.log('activecampaign-deal-link contract: PASS')
