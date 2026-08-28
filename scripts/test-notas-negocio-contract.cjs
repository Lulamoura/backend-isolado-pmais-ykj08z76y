const fs = require('node:fs')
const assert = require('node:assert/strict')
const migration = fs.readFileSync('pocketbase/migrations/202608280530_notas_negocio.js', 'utf8')
const hook = fs.readFileSync('pocketbase/hooks/com_notas_negocio.js', 'utf8')
const relay = fs.readFileSync('pocketbase/hooks/ac_native_relay.js', 'utf8')
assert.ok(
  hook.trimStart().startsWith('routerAdd('),
  'hook callbacks must not depend on top-level helpers',
)
assert.match(migration, /com_notas_negocio/)
assert.match(migration, /UNIQUE INDEX idx_com_notas_negocio_external/)
assert.match(hook, /\/backend\/v1\/negocios\/\{id\}\/notas/)
assert.match(hook, /SuperAdmin necessario/)
assert.match(hook, /filters\[relid\]/)
assert.match(hook, /offset=/)
assert.match(hook, /getString\('record_id'\)/)
assert.doesNotMatch(hook, /getString\('internal_id'\)/)
assert.doesNotMatch(hook, /Api-Token['"]\s*:\s*['"][^'"]+['"]/)
assert.match(relay, /deal_note_add/)
assert.match(relay, /NEGOCIO_NAO_ESPELHADO/)
assert.match(relay, /replay: true/)

const atividadesPage = fs.readFileSync('src/pages/Atividades.tsx', 'utf8')
const qualificacoesPage = fs.readFileSync('src/pages/Qualificacoes.tsx', 'utf8')
const slasPage = fs.readFileSync('src/pages/Slas.tsx', 'utf8')
const commercialCard = fs.readFileSync('src/components/CommercialContextCard.tsx', 'utf8')

assert.ok(
  atividadesPage.includes('BusinessNotesDialog'),
  'Atividades deve oferecer BusinessNotesDialog',
)
assert.ok(
  qualificacoesPage.includes('BusinessNotesDialog'),
  'Qualificacoes deve oferecer BusinessNotesDialog',
)
assert.ok(
  slasPage.includes('CommercialContextCard') && commercialCard.includes('BusinessNotesDialog'),
  'SLA deve oferecer notas via CommercialContextCard',
)

console.log('notas-negocio contract: PASS')
