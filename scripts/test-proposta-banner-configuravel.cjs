const fs = require('node:fs')

const read = (path) => fs.readFileSync(path, 'utf8')
const hook = read('pocketbase/hooks/com_proposta_banner.js')
const migration = read('pocketbase/migrations/202609050015_proposta_banner_configuravel.js')
const service = read('src/services/configuracoes.ts')
const admin = read('src/components/foundation/BannerPropostaCard.tsx')
const publica = read('src/pages/PropostaPublica.tsx')

const checks = [
  ['coleção fechada para gravação direta', migration.includes('createRule: null')],
  ['arquivo limitado a cinco MB', migration.includes('maxSize: 5242880')],
  [
    'formatos de imagem permitidos',
    /image\/jpeg[\s\S]*image\/png[\s\S]*image\/webp/.test(migration),
  ],
  ['chave global única', migration.includes('idx_com_configuracoes_arquivos_chave')],
  [
    'consulta pública do banner',
    hook.includes("'GET', '/backend/v1/configuracoes/proposta-banner'"),
  ],
  [
    'upload administrativo',
    hook.includes("'POST',\n  '/backend/v1/admin/configuracoes/proposta-banner'"),
  ],
  [
    'restauração administrativa',
    hook.includes("'DELETE',\n  '/backend/v1/admin/configuracoes/proposta-banner'"),
  ],
  ['administração restrita ao SuperAdmin', hook.includes("!== 'superadministrador'")],
  ['assinatura binária validada', hook.includes('IMAGEM_ASSINATURA_INVALIDA')],
  ['fallback seguro preservado', hook.includes("url: '/proposta-banner.jpg'")],
  ['alteração auditada', hook.includes('configurar_banner_proposta_publica')],
  ['serviço usa FormData', service.includes("body.append('arquivo', arquivo)")],
  ['interface informa dimensões', admin.includes('1280 × 320 px')],
  ['interface exige justificativa', admin.includes('Motivo da alteração *')],
  ['página pública consulta configuração', publica.includes('obterBannerPropostaPublica()')],
  ['página pública recupera fallback', publica.includes("setBannerUrl('/proposta-banner.jpg')")],
]

let passed = 0
for (const [name, ok] of checks) {
  if (!ok) {
    console.error(`TEST FAIL: ${name}`)
    process.exitCode = 1
  } else {
    console.log(`TEST PASS: ${name}`)
    passed += 1
  }
}
console.log(`\nRESULTADO: ${passed}/${checks.length} aprovados`)
