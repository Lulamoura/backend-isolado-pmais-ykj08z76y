const assert = require('assert')
const fs = require('fs')
const vm = require('vm')

class MockRecord {
  constructor(id, values) {
    this.id = id
    this.values = { ...(values || {}) }
  }
  getString(name) {
    const value = this.values[name]
    return value === undefined || value === null ? '' : String(value)
  }
  getBool(name) {
    return Boolean(this.values[name])
  }
}

const profile = new MockRecord('profile-manager', {
  ativo: true,
  slug: 'gestor-comercial',
})
const actor = new MockRecord('user-manager', {
  ativo_comercial: true,
  perfil_id: profile.id,
})

const ledgerRows = [
  new MockRecord('ledger-sensitive', {
    fonte: 'whatsapp_uazapi',
    canal: 'WhatsApp Comercial',
    empresa_nome: 'Cliente A',
    negocio_ref: 'OE-100',
    responsavel: 'Equipe 1',
    fato: 'Cliente pediu desconto e alteração no preço da proposta.',
    destino_sugerido: 'historico',
    risco: 'baixo',
    confianca: 'media',
    promocao_modo: 'promover_baixo_risco',
    occurred_at: '2026-10-01 12:00:00.000Z',
  }),
  new MockRecord('ledger-pending', {
    fonte: 'app_comercial',
    canal: 'Follow-up',
    empresa_nome: 'Cliente B',
    negocio_ref: 'OE-101',
    fato: 'Retorno comercial aguardando confirmação.',
    destino_sugerido: 'pendencia',
    risco: 'baixo',
    confianca: 'alta',
    occurred_at: '2026-10-01 11:00:00.000Z',
  }),
  new MockRecord('ledger-curation', {
    fonte: 'nexo_app',
    canal: 'Ajuda do Nexo',
    empresa_nome: 'Cliente C',
    negocio_ref: 'OE-102',
    fato: 'Padrão de objeção precisa de revisão do gestor.',
    destino_sugerido: 'curadoria',
    risco: 'medio',
    confianca: 'media',
    occurred_at: '2026-10-01 10:00:00.000Z',
  }),
  new MockRecord('ledger-low-risk', {
    fonte: 'whatsapp_uazapi',
    canal: 'WhatsApp Comercial',
    empresa_nome: 'Cliente D',
    negocio_ref: 'OE-103',
    fato: 'Cliente prefere receber resumo objetivo antes da reunião.',
    destino_sugerido: 'historico',
    risco: 'baixo',
    confianca: 'alta',
    promocao_modo: 'promover_baixo_risco',
    occurred_at: '2026-10-01 09:00:00.000Z',
  }),
  new MockRecord('ledger-no-action', {
    fonte: 'whatsapp_uazapi',
    canal: 'WhatsApp Comercial',
    fato: 'Saudação registrada.',
    destino_sugerido: 'historico',
    risco: 'baixo',
    confianca: 'media',
    occurred_at: '2026-10-01 08:00:00.000Z',
  }),
]

let saveCalls = 0
const app = {
  findRecordById(collection, id) {
    if (collection === 'com_perfis' && id === profile.id) return profile
    throw new Error('not found')
  },
  findRecordsByFilter(collection, _filter, _sort, limit, offset) {
    if (collection !== 'com_ledger_comercial') return []
    return ledgerRows.slice(offset || 0, (offset || 0) + (limit || ledgerRows.length))
  },
  save() {
    saveCalls++
  },
}

const routes = {}
const context = {
  console,
  Date,
  JSON,
  Math,
  $app: app,
  $os: { getenv: () => '' },
  $http: { send: () => ({ statusCode: 500, json: {}, raw: '' }) },
  $security: { sha256: (value) => `hash:${value}` },
  $apis: {
    bodyLimit: () => function () {},
    requireAuth: () => function () {},
  },
  routerAdd(method, path, callback) {
    routes[`${method} ${path}`] = callback
  },
}
vm.createContext(context)
vm.runInContext(
  fs.readFileSync('pocketbase/hooks/com_nexo_central_operacional.js', 'utf8'),
  context,
)

const route = routes['POST /backend/v1/nexo/curadoria/triagem-shadow']
assert(route, 'rota de triagem conservadora em shadow mode deve existir')

function invoke(auth) {
  let response = null
  const e = {
    auth,
    requestInfo() {
      return { body: { limite: 100 } }
    },
    json(status, payload) {
      response = { status, payload }
      return response
    },
    forbiddenError(message) {
      response = { status: 403, payload: { message } }
      return response
    },
  }
  route(e)
  return response
}

const response = invoke(actor)
assert.equal(response.status, 200)
assert.equal(response.payload.modo, 'shadow')
assert.deepEqual(response.payload.contadores, {
  total_analisado: 5,
  sem_acao: 1,
  pendencia: 1,
  baixo_risco: 1,
  curadoria: 1,
  direcao: 1,
})
assert.equal(saveCalls, 0, 'shadow mode não pode persistir registros')
assert.equal(response.payload.guardrails.sem_mutacao, true)
assert.equal(response.payload.guardrails.sem_envio, true)
assert.equal(response.payload.guardrails.automatic_send_allowed, false)
assert.equal(response.payload.guardrails.sem_promocao, true)
assert.equal(
  response.payload.itens.some((item) => 'id' in item),
  false,
)

const sensitive = response.payload.itens.find((item) => item.destino === 'direcao')
assert(sensitive)
assert(sensitive.motivos.includes('preco_ou_desconto'))
assert.match(sensitive.resumo, /desconto/i)

const inactive = new MockRecord('inactive', {
  ativo_comercial: false,
  perfil_id: profile.id,
})
assert.equal(invoke(inactive).status, 403)

const integrationProfile = new MockRecord('profile-integration', {
  ativo: true,
  slug: 'integracao',
})
app.findRecordById = (collection, id) => {
  if (collection === 'com_perfis' && id === integrationProfile.id) return integrationProfile
  throw new Error('not found')
}
const integrationActor = new MockRecord('integration-user', {
  ativo_comercial: true,
  perfil_id: integrationProfile.id,
})
assert.equal(invoke(integrationActor).status, 403)

console.log('nexo-curadoria-triagem-shadow runtime: PASS')
