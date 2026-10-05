const assert = require('assert')
const fs = require('fs')
const vm = require('vm')

class MockRecord {
  constructor(collection, id, values) {
    this.collection = collection
    this.id = id || ''
    this.values = { ...(values || {}) }
  }
  getString(name) {
    const value = this.values[name]
    return value === undefined || value === null ? '' : String(value)
  }
  getBool(name) {
    return Boolean(this.values[name])
  }
  getInt(name) {
    return Number(this.values[name] || 0)
  }
  getFloat(name) {
    return Number(this.values[name] || 0)
  }
  get(name) {
    return this.values[name]
  }
  set(name, value) {
    this.values[name] = value
  }
}

function byteCandidate(serialized) {
  const raw = Array.from(Buffer.from(serialized))
  Object.defineProperty(raw, 'toString', { value: () => serialized, enumerable: false })
  return raw
}

const profile = new MockRecord('com_perfis', 'profile-admin', {
  ativo: true,
  slug: 'superadministrador',
})
const actor = new MockRecord('users', 'user-admin', {
  ativo_comercial: true,
  perfil_id: profile.id,
})
const executiveProfile = new MockRecord('com_perfis', 'profile-executive', {
  ativo: true,
  slug: 'leitura-executiva',
})
const executive = new MockRecord('users', 'user-executive', {
  ativo_comercial: true,
  perfil_id: executiveProfile.id,
})

const ledger = [
  new MockRecord('com_ledger_comercial', 'ledger-1', {
    fonte: 'whatsapp_uazapi',
    canal: 'WhatsApp Comercial',
    empresa_nome: 'Cliente A',
    negocio_id: 'negocio-201',
    negocio_ref: 'OE-201',
    responsavel: 'Equipe 1',
    equipe_id: 'equipe-comercial',
    tipo_evento: 'mensagem',
    fato: 'Cliente prefere receber resumo objetivo antes da reunião.',
    evidencia_ref: 'event-1',
    destino_sugerido: 'historico',
    risco: 'baixo',
    confianca: 'alta',
    promocao_modo: 'promover_baixo_risco',
    occurred_at: '2026-09-28 12:00:00.000Z',
    status: 'novo',
  }),
  new MockRecord('com_ledger_comercial', 'ledger-2', {
    fonte: 'nexo_app',
    canal: 'Ajuda do Nexo',
    empresa_nome: 'Cliente A',
    negocio_ref: ' oe-201 ',
    responsavel: 'Equipe 1',
    equipe_id: 'equipe-comercial',
    tipo_evento: 'preferencia_comunicacao',
    fato: 'Reforçada preferência por resumo objetivo antes da reunião.',
    evidencia_ref: 'event-2',
    destino_sugerido: 'curadoria',
    risco: 'baixo',
    confianca: 'media',
    occurred_at: '2026-09-29 12:00:00.000Z',
    status: 'novo',
  }),
  new MockRecord('com_ledger_comercial', 'ledger-3', {
    fonte: 'whatsapp_uazapi',
    canal: 'WhatsApp Comercial',
    empresa_nome: 'Cliente B',
    negocio_ref: 'OE-202',
    responsavel: 'Equipe 2',
    equipe_id: 'equipe-comercial',
    tipo_evento: 'mensagem',
    fato: 'Contato prefere receber resumo objetivo antes da reunião.',
    evidencia_ref: 'event-3',
    destino_sugerido: 'historico',
    risco: 'baixo',
    confianca: 'alta',
    promocao_modo: 'promover_baixo_risco',
    occurred_at: '2026-09-30 12:00:00.000Z',
    status: 'novo',
  }),
  new MockRecord('com_ledger_comercial', 'ledger-4', {
    fonte: 'whatsapp_uazapi',
    canal: 'WhatsApp Comercial',
    empresa_nome: 'Cliente A',
    negocio_ref: 'OE-201',
    responsavel: 'Equipe 1',
    equipe_id: 'equipe-comercial',
    tipo_evento: 'mensagem',
    fato: 'Cliente pediu desconto e alteração do preço.',
    evidencia_ref: 'event-4',
    destino_sugerido: 'historico',
    risco: 'baixo',
    confianca: 'media',
    promocao_modo: 'promover_baixo_risco',
    occurred_at: '2026-10-01 12:00:00.000Z',
    status: 'novo',
  }),
  new MockRecord('com_ledger_comercial', 'ledger-low-confidence', {
    fonte: 'nexo_app',
    canal: 'Ajuda do Nexo',
    empresa_nome: 'Cliente isolado',
    negocio_ref: 'OE-ISOLADO',
    responsavel: 'Equipe 1',
    equipe_id: 'equipe-comercial',
    tipo_evento: 'mensagem',
    fato: 'Pedido isolado de informação operacional.',
    evidencia_ref: 'event-low-confidence',
    destino_sugerido: 'historico',
    risco: 'baixo',
    confianca: 'baixa',
    occurred_at: '2026-10-01 13:00:00.000Z',
    status: 'novo',
  }),
  new MockRecord('com_ledger_comercial', 'ledger-sensitive-unlinked', {
    fonte: 'whatsapp_uazapi',
    canal: 'WhatsApp Comercial',
    tipo_evento: 'mensagem',
    fato: 'Contato sem vínculo relatou possível vazamento de dados pessoais.',
    evidencia_ref: 'event-sensitive-unlinked',
    destino_sugerido: 'curadoria',
    risco: 'alto',
    confianca: 'media',
    occurred_at: '2026-10-01 14:00:00.000Z',
    status: 'novo',
  }),
  ...['A', 'B', 'C'].map(
    (suffix, index) =>
      new MockRecord('com_ledger_comercial', `ledger-no-team-${suffix}`, {
        fonte: 'activecampaign',
        canal: 'ActiveCampaign',
        empresa_nome: `Cliente sem equipe ${suffix}`,
        negocio_ref: `OE-SEM-EQUIPE-${suffix}`,
        tipo_evento: 'preferencia_comunicacao',
        fato: 'Contato prefere receber resumo objetivo antes da reunião.',
        evidencia_ref: `event-no-team-${suffix}`,
        destino_sugerido: 'curadoria',
        risco: 'baixo',
        confianca: 'alta',
        occurred_at: `2026-10-01 ${15 + index}:00:00.000Z`,
        status: 'novo',
      }),
  ),
]

const collections = {
  com_perfis: [profile, executiveProfile],
  com_ledger_comercial: ledger,
  com_nexo_curadoria_casos: [],
  com_nexo_curadoria_evidencias: [],
  com_nexo_curadoria_transicoes: [],
  com_nexo_curadoria_outbox: [],
}
let nextId = 1
let saveCalls = 0

function rowsFor(name) {
  if (!collections[name]) collections[name] = []
  return collections[name]
}

const app = {
  findRecordById(collection, id) {
    const rec = rowsFor(collection).find((row) => row.id === id)
    if (!rec) throw new Error('not found')
    return rec
  },
  findRecordsByFilter(collection, _filter, _sort, limit, offset) {
    const rows = rowsFor(collection)
    return rows.slice(offset || 0, (offset || 0) + (limit || rows.length))
  },
  findCollectionByNameOrId(name) {
    return { name }
  },
  save(record) {
    saveCalls++
    const name = record.collection.name || record.collection
    const rows = rowsFor(name)
    if (!record.id) {
      record.id = `generated-${nextId++}`
      rows.push(record)
    }
  },
  runInTransaction(callback) {
    return callback(this)
  },
}

function RecordCtor(collection) {
  return new MockRecord(collection, '', {})
}

const routes = {}
const context = {
  console,
  Date,
  JSON,
  Math,
  Record: RecordCtor,
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
vm.runInContext(fs.readFileSync('pocketbase/hooks/com_propostas_operacao.js', 'utf8'), context)

const route = routes['POST /backend/v1/nexo/curadoria/casos/consolidar']
assert(route, 'rota governada de consolidação de casos deve existir')

function invoke(body, auth = actor) {
  let response = null
  const e = {
    auth,
    requestInfo() {
      return { body: body || {} }
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

const dryRun = invoke({ dry_run: true })
assert.equal(dryRun.status, 200)
assert.equal(dryRun.payload.dry_run, true)
assert.equal(dryRun.payload.casos_novos, 2, 'matéria sensível entra imediatamente')
assert.equal(dryRun.payload.evidencias_novas, 2)
assert.equal(saveCalls, 0)
assert.equal(collections.com_nexo_curadoria_casos.length, 0)

const noConfirmation = invoke({ dry_run: false })
assert.equal(noConfirmation.status, 400)
assert.equal(collections.com_nexo_curadoria_casos.length, 0)

const executiveDryRun = invoke({ dry_run: true }, executive)
assert.equal(executiveDryRun.status, 200, 'leitura executiva pode consultar a prévia sem mutação')
const executiveApply = invoke(
  { dry_run: false, confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL' },
  executive,
)
assert.equal(executiveApply.status, 403, 'leitura executiva nunca pode aplicar consolidação')
assert.equal(collections.com_nexo_curadoria_casos.length, 0)

const applied = invoke({
  dry_run: false,
  confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
})
assert.equal(applied.status, 200)
assert.equal(applied.payload.casos_criados, 2)
assert.equal(applied.payload.evidencias_criadas, 2)
assert.equal(applied.payload.transicoes_criadas, 2)
assert.equal(collections.com_nexo_curadoria_casos.length, 2)
assert.equal(collections.com_nexo_curadoria_evidencias.length, 2)
assert.equal(
  collections.com_nexo_curadoria_casos.filter(
    (item) => item.getString('assunto_chave') === 'preferencia_comunicacao',
  ).length,
  0,
  'dois escopos independentes ainda não devem sobrecarregar a fila humana',
)
assert.equal(
  collections.com_nexo_curadoria_casos.some(
    (item) => item.getString('negocio_numero') === 'OE-ISOLADO',
  ),
  false,
  'baixa confiança isolada não cria caso',
)
assert.equal(
  collections.com_nexo_curadoria_casos.some(
    (item) => item.getString('escopo_tipo') === 'organizacao',
  ),
  false,
  'sinais comuns sem equipe canônica não devem formar fila executiva global',
)
const unlinkedSensitiveCase = collections.com_nexo_curadoria_casos.find(
  (item) => item.getString('assunto_chave') === 'lgpd_ou_dados_pessoais',
)
assert(unlinkedSensitiveCase, 'matéria sensível sem vínculo não pode ser descartada')
assert.equal(unlinkedSensitiveCase.getString('escopo_tipo'), 'evidencia')
assert.equal(unlinkedSensitiveCase.getString('alcada'), 'direcao')

const sensitiveCase = collections.com_nexo_curadoria_casos.find(
  (item) => item.getString('assunto_chave') === 'preco_ou_desconto',
)
assert(sensitiveCase)
assert.equal(sensitiveCase.getString('status'), 'aguardando_direcao')
assert.equal(sensitiveCase.getString('alcada'), 'direcao')
assert.equal(sensitiveCase.getBool('automatic_promotion_allowed'), false)

const legacyPreferenceCase = new MockRecord('com_nexo_curadoria_casos', 'legacy-preference-case', {
  fingerprint: 'hash:curadoria-caso-v1|negocio|OE-201|preferencia_comunicacao',
  revisao: 1,
  status: 'aberto_curadoria',
  escopo_tipo: 'negocio',
  escopo_ref: 'OE-201',
  empresa_nome: 'Cliente A',
  negocio_numero: 'OE-201',
  equipe_id: 'equipe-comercial',
  assunto_chave: 'preferencia_comunicacao',
  fontes: byteCandidate('["activecampaign"]'),
  evidencia_hashes: byteCandidate('["hash:legacy-evidence"]'),
  human_review_required: true,
  automatic_promotion_allowed: false,
  conhecimento_status: 'nao_publicado',
})
collections.com_nexo_curadoria_casos.push(legacyPreferenceCase)

for (const [suffix, negocioRef] of [
  ['A', 'OE-L1'],
  ['B', 'OE-L2'],
  ['C', 'OE-L3'],
]) {
  ledger.push(
    new MockRecord('com_ledger_comercial', `ledger-legacy-ambiguous-${suffix}`, {
      fonte: 'activecampaign',
      canal: 'ActiveCampaign',
      empresa_nome: `Cliente legado ${suffix}`,
      negocio_ref: negocioRef,
      equipe_id: 'equipe-legada',
      tipo_evento: 'objecao_comercial',
      fato: 'Cliente apresentou objeção comercial recorrente.',
      evidencia_ref: `event-legacy-ambiguous-${suffix}`,
      destino_sugerido: 'curadoria',
      risco: 'baixo',
      confianca: 'alta',
      occurred_at: `2026-10-02 0${suffix.charCodeAt(0) - 64}:00:00.000Z`,
      status: 'novo',
    }),
  )
}
for (const [id, negocioRef] of [
  ['legacy-ambiguous-1', 'OE-L1'],
  ['legacy-ambiguous-2', 'OE-L2'],
]) {
  collections.com_nexo_curadoria_casos.push(
    new MockRecord('com_nexo_curadoria_casos', id, {
      fingerprint: `hash:curadoria-caso-v1|negocio|${negocioRef}|objecao_comercial`,
      revisao: 1,
      status: 'aberto_curadoria',
      escopo_tipo: 'negocio',
      escopo_ref: negocioRef,
      equipe_id: 'equipe-legada',
      assunto_chave: 'objecao_comercial',
      fontes: [],
      evidencia_hashes: [],
      conhecimento_status: 'nao_publicado',
    }),
  )
}

const thirdPreference = new MockRecord('com_ledger_comercial', 'ledger-5', {
  fonte: 'activecampaign',
  canal: 'ActiveCampaign',
  empresa_nome: 'Cliente C',
  negocio_ref: 'OE-203',
  responsavel: 'Equipe 3',
  equipe_id: 'equipe-comercial',
  tipo_evento: 'preferencia_comunicacao',
  fato: 'Contato prefere receber resumo objetivo antes da reunião.',
  evidencia_ref: 'event-5',
  destino_sugerido: 'curadoria',
  risco: 'baixo',
  confianca: 'alta',
  occurred_at: '2026-10-02 12:00:00.000Z',
  status: 'novo',
})
ledger.push(thirdPreference)
const recurrenceApply = invoke({
  dry_run: false,
  confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
})
assert.equal(recurrenceApply.status, 200)
assert.equal(recurrenceApply.payload.casos_criados, 0, 'caso legado deve ser reaproveitado')
assert.equal(recurrenceApply.payload.casos_atualizados, 1)
assert.equal(recurrenceApply.payload.evidencias_criadas, 4)
assert.equal(
  recurrenceApply.payload.casos_legados_ambiguos,
  1,
  'múltiplos legados devem falhar fechados sem criar novo caso',
)
assert.equal(
  collections.com_nexo_curadoria_casos.some(
    (item) =>
      item.getString('fingerprint') ===
      'hash:curadoria-padrao-v2|equipe|equipe-legada|objecao_comercial',
  ),
  false,
  'grupo legado ambíguo não deve gerar terceiro caso',
)

const preferenceCases = collections.com_nexo_curadoria_casos.filter(
  (item) => item.getString('assunto_chave') === 'preferencia_comunicacao',
)
assert.equal(preferenceCases.length, 1, 'caso legado não pode coexistir com duplicata por equipe')
const preferenceCase = preferenceCases[0]
assert.equal(preferenceCase.id, legacyPreferenceCase.id)
assert.equal(
  preferenceCase.getString('fingerprint'),
  'hash:curadoria-caso-v1|negocio|OE-201|preferencia_comunicacao',
  'fingerprint legado publicado deve permanecer estável',
)
assert.equal(preferenceCase.getInt('recorrencia_contagem'), 3)
assert.equal(preferenceCase.getInt('evidencia_contagem'), 5)
assert(preferenceCase.get('fontes').includes('activecampaign'))
assert(preferenceCase.get('evidencia_hashes').includes('hash:legacy-evidence'))
assert.equal(preferenceCase.getString('escopo_tipo'), 'negocio')
assert.equal(preferenceCase.getString('equipe_id'), 'equipe-comercial')
assert.equal(preferenceCase.getBool('human_review_required'), true)
assert.equal(preferenceCase.getBool('automatic_promotion_allowed'), false)

sensitiveCase.set('status', 'aprovado')
sensitiveCase.set('conhecimento_status', 'ativo')
sensitiveCase.set('validado_por', 'director-1')
sensitiveCase.set('approved_at', '2026-10-01 00:00:00.000Z')
sensitiveCase.set('next_review_at', '2030-09-01 00:00:00.000Z')
const confirmingSensitiveEvidence = new MockRecord('com_ledger_comercial', 'ledger-6', {
  fonte: 'whatsapp_uazapi',
  canal: 'WhatsApp Comercial',
  empresa_nome: 'Cliente A',
  negocio_ref: 'OE-201',
  responsavel: 'Equipe 1',
  equipe_id: 'equipe-comercial',
  tipo_evento: 'mensagem',
  fato: 'Cliente voltou a pedir desconto no preço.',
  evidencia_ref: 'event-6',
  destino_sugerido: 'curadoria',
  risco: 'medio',
  confianca: 'alta',
  occurred_at: '2026-10-03 12:00:00.000Z',
  status: 'novo',
})
ledger.push(confirmingSensitiveEvidence)
const confirmed = invoke({
  dry_run: false,
  confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
})
assert.equal(confirmed.status, 200)
assert.equal(confirmed.payload.casos_criados, 0)
assert.equal(confirmed.payload.casos_atualizados, 1)
assert.equal(confirmed.payload.evidencias_criadas, 1)
assert.equal(confirmed.payload.transicoes_criadas, 0)
assert.equal(sensitiveCase.getString('status'), 'aprovado')
assert.equal(sensitiveCase.getInt('revisao'), 1, 'evidência confirmatória não cria nova revisão')
assert.equal(sensitiveCase.getString('conhecimento_status'), 'ativo')

const keywordOnlyEvidence = new MockRecord('com_ledger_comercial', 'ledger-keyword-only', {
  fonte: 'whatsapp_uazapi',
  canal: 'WhatsApp Comercial',
  empresa_nome: 'Cliente A',
  negocio_ref: 'OE-201',
  responsavel: 'Equipe 1',
  equipe_id: 'equipe-comercial',
  tipo_evento: 'mensagem',
  fato: 'Cliente escreveu que a regra vigente não se aplica e pediu mudança de regra.',
  evidencia_ref: 'event-keyword-only',
  destino_sugerido: 'curadoria',
  risco: 'medio',
  confianca: 'media',
  occurred_at: '2026-10-03 13:00:00.000Z',
  status: 'novo',
})
ledger.push(keywordOnlyEvidence)
const keywordOnly = invoke({
  dry_run: false,
  confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
})
assert.equal(keywordOnly.status, 200)
assert.equal(keywordOnly.payload.evidencias_criadas, 1)
assert.equal(keywordOnly.payload.transicoes_criadas, 1)
assert.equal(keywordOnly.payload.casos_criados, 1)
assert.equal(sensitiveCase.getString('status'), 'aprovado')
assert.equal(
  sensitiveCase.getInt('revisao'),
  1,
  'texto externo sozinho não decide contradição material',
)

const contradictorySensitiveEvidence = new MockRecord('com_ledger_comercial', 'ledger-7', {
  fonte: 'reuniao',
  canal: 'Reunião comercial',
  empresa_nome: 'Cliente A',
  negocio_ref: 'OE-201',
  responsavel: 'Equipe 1',
  equipe_id: 'equipe-comercial',
  tipo_evento: 'mudanca_regra',
  fato: 'A política comercial mudou e a regra vigente de desconto não se aplica a este cenário.',
  observacao: 'Contradição material confirmada pela direção.',
  revisao_status: 'contradicao_material',
  evidencia_ref: 'event-7',
  destino_sugerido: 'curadoria',
  risco: 'alto',
  confianca: 'alta',
  occurred_at: '2026-10-04 12:00:00.000Z',
  status: 'novo',
})
ledger.push(contradictorySensitiveEvidence)
const reopenedByContradiction = invoke({
  dry_run: false,
  confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
})
assert.equal(reopenedByContradiction.status, 200)
assert.equal(reopenedByContradiction.payload.casos_criados, 0)
assert.equal(reopenedByContradiction.payload.casos_atualizados, 1)
assert.equal(reopenedByContradiction.payload.evidencias_criadas, 1)
assert.equal(reopenedByContradiction.payload.transicoes_criadas, 1)
assert.equal(sensitiveCase.getString('status'), 'aguardando_direcao')
assert.equal(sensitiveCase.getInt('revisao'), 2)
assert.equal(sensitiveCase.getString('conhecimento_status'), 'revisao_necessaria')
assert.equal(sensitiveCase.getString('validado_por'), 'director-1')
assert.equal(sensitiveCase.getString('approved_at'), '2026-10-01 00:00:00.000Z')
const contradictionTransition = collections.com_nexo_curadoria_transicoes.find(
  (item) =>
    item.getString('caso_id') === sensitiveCase.id &&
    item.getString('status_anterior') === 'aprovado',
)
assert(contradictionTransition, 'reabertura material deve ser auditada')
assert.match(contradictionTransition.getString('motivo'), /materialidade estruturada/i)
assert.equal(contradictionTransition.get('metadados').gatilho, 'materialidade_estruturada')
const contradictionEvidence = collections.com_nexo_curadoria_evidencias.find(
  (item) => item.getString('fonte_ref') === 'event-7',
)
assert(contradictionEvidence, 'evidência material deve ser preservada')
assert.equal(contradictionEvidence.get('metadados').revisao_material, true)

const preferenceRevisionBeforeReview = preferenceCase.getInt('revisao')
preferenceCase.set('status', 'aprovado')
preferenceCase.set('conhecimento_status', 'ativo')
preferenceCase.set('validado_por', 'manager-1')
preferenceCase.set('approved_at', '2026-10-02 00:00:00.000Z')
preferenceCase.set('next_review_at', '2020-01-01 00:00:00.000Z')
const reopenedByReviewDate = invoke({
  dry_run: false,
  confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
})
assert.equal(reopenedByReviewDate.status, 200)
assert.equal(reopenedByReviewDate.payload.casos_criados, 0)
assert.equal(reopenedByReviewDate.payload.casos_atualizados, 1)
assert.equal(reopenedByReviewDate.payload.evidencias_criadas, 0)
assert.equal(reopenedByReviewDate.payload.transicoes_criadas, 1)
assert.equal(preferenceCase.getString('status'), 'aberto_curadoria')
assert.equal(preferenceCase.getInt('revisao'), preferenceRevisionBeforeReview + 1)
assert.equal(preferenceCase.getString('conhecimento_status'), 'revisao_necessaria')
const reviewDateTransition = collections.com_nexo_curadoria_transicoes.find(
  (item) =>
    item.getString('caso_id') === preferenceCase.id &&
    item.getString('status_anterior') === 'aprovado',
)
assert(reviewDateTransition, 'reabertura por revisão vencida deve ser auditada')
assert.match(reviewDateTransition.getString('motivo'), /revisão programada vencida/i)
assert.equal(reviewDateTransition.get('metadados').gatilho, 'revisao_vencida')

const secondApply = invoke({
  dry_run: false,
  confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
})
assert.equal(secondApply.status, 200)
assert.equal(secondApply.payload.casos_criados, 0)
assert.equal(secondApply.payload.casos_atualizados, 0)
assert.equal(secondApply.payload.evidencias_criadas, 0)
assert.equal(secondApply.payload.transicoes_criadas, 0)
assert.equal(secondApply.payload.automatic_send_allowed, false)
assert.equal('caso_ids' in secondApply.payload, false)

console.log('nexo-curadoria-casos-consolidar runtime: PASS')
