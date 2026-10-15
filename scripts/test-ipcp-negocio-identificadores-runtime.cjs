const fs = require('node:fs')
const assert = require('node:assert/strict')
const vm = require('node:vm')

const hook = fs.readFileSync('pocketbase/hooks/com_ipcp_diario.js', 'utf8')
const routeStart = hook.indexOf("'/backend/v1/nexo/ipcp/diario'")
assert.notEqual(routeStart, -1, 'rota viva do IPCP deve existir')
const activeStart = hook.indexOf('    function activeCampaignDealId(rec)', routeStart)
const helperEnd = hook.indexOf('    function textoRegistroComercial(rec)', activeStart)
assert.ok(
  activeStart > routeStart && helperEnd > activeStart,
  'helpers de identificadores devem existir',
)
const helperSource = hook.slice(activeStart, helperEnd)

const technicalWithBinding = 'abcde12345fghij'
const technicalWithoutBinding = 'klmno67890pqrst'
const records = {
  [technicalWithBinding]: {
    id: technicalWithBinding,
    getString: (field) => (field === 'oe_numero' ? 'OE-2026-123' : ''),
  },
  [technicalWithoutBinding]: {
    id: technicalWithoutBinding,
    getString: (field) => (field === 'oe_numero' ? 'OE-2026-123' : ''),
  },
}
const bindings = {
  [technicalWithBinding]: '4887',
}
const app = {
  findRecordById(collection, id) {
    assert.equal(collection, 'com_negocios')
    if (!records[id]) throw new Error('record not found')
    return records[id]
  },
  findFirstRecordByFilter(collection, filter) {
    assert.equal(collection, 'com_vinculos_externos')
    assert.match(filter, /sistema_origem='activecampaign'/)
    assert.match(filter, /external_type='business'/)
    const match = filter.match(/record_id='([^']+)'/)
    const externalId = match ? bindings[match[1]] : ''
    if (!externalId) throw new Error('binding not found')
    return { getString: (field) => (field === 'external_id' ? externalId : '') }
  },
}

const helpers = vm.runInNewContext(
  `(() => {
    function esc(value) { return String(value || '').replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'") }
    ${helperSource}
    return { activeCampaignDealId, negocioHumanoId, normalizarNegociosAtencaoParaResposta }
  })()`,
  { $app: app, decodeURIComponent, encodeURIComponent, Object, String },
)

const repaired = helpers.normalizarNegociosAtencaoParaResposta([
  {
    id_negocio: technicalWithBinding,
    link: `/pipeline?negocio=${technicalWithBinding}`,
    cliente: 'Cliente omitido',
  },
])[0]
assert.equal(repaired.negocio_id, technicalWithBinding)
assert.equal(repaired.external_id, '4887')
assert.equal(repaired.id_negocio, 'OE-2026-123', 'número humano deve ficar separado do AC')
assert.equal(repaired.link, `/pipeline?negocio=${technicalWithBinding}`)

const withoutBinding = helpers.normalizarNegociosAtencaoParaResposta([
  {
    negocio_id: technicalWithoutBinding,
    id_negocio: 'OE-2026-123',
    external_id: 'OE-2026-123',
    link: `/pipeline?negocio=${technicalWithoutBinding}`,
  },
])[0]
assert.equal(withoutBinding.negocio_id, technicalWithoutBinding)
assert.equal(withoutBinding.external_id, null, 'OE/código não pode virar ID do ActiveCampaign')
assert.equal(withoutBinding.id_negocio, 'OE-2026-123', 'número humano pode continuar visível')
assert.equal(withoutBinding.link, `/pipeline?negocio=${technicalWithoutBinding}`)

const legacyWithoutInternalId = helpers.normalizarNegociosAtencaoParaResposta([
  {
    id_negocio: 'OE-2026-999',
    external_id: 'OE-2026-999',
    link: '/pipeline?negocio=OE-2026-999',
  },
])[0]
assert.equal(legacyWithoutInternalId.external_id, null)
assert.equal(legacyWithoutInternalId.id_negocio, 'OE-2026-999')
assert.equal(legacyWithoutInternalId.negocio_id, null)
assert.equal(
  Object.hasOwn(legacyWithoutInternalId, 'link'),
  false,
  'link legado sem ID PocketBase recuperável deve ser removido',
)

assert.equal((hook.match(/negocio_id:\s*item\.id/g) || []).length, 3)
assert.equal((hook.match(/external_id:\s*externalId/g) || []).length, 3)
assert.equal(
  (hook.match(/link:\s*'\/pipeline\?negocio=' \+ encodeURIComponent\(item\.id\)/g) || []).length,
  3,
  'todos os produtores devem persistir link interno com ID PocketBase',
)
assert.doesNotMatch(
  hook,
  /link:\s*'\/pipeline\?negocio=' \+ encodeURIComponent\(negocioHumanoId\(item\)\)/,
)

console.log('ipcp-negocio-identificadores runtime: PASS')
