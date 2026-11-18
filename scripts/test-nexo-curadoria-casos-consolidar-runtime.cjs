const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const vm = require('vm')

const POLICY_VERSION = 'pmais_nexo_auto_promotion_policy_v1'
const AUTOMATIC_SCHEMA_VERSION = 'pmais_nexo_curadoria_conhecimento_automatico_v1'
const AUTOMATIC_AGENT_ID = 'nexo-curadoria-automatico'
const CUTOFF_CREATED = '2026-09-30 23:59:59.999Z'
const CUTOFF_ID = 'zzzzzzzzzzzzzzz'

class MockRecord {
  constructor(collection, id, values) {
    this.collection = collection
    this.id = id || ''
    this.values = { ...(values || {}) }
    if (collection === 'com_ledger_comercial' && !this.values.created && this.values.occurred_at)
      this.values.created = this.values.occurred_at
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
const policy = {
  policy_version: POLICY_VERSION,
  cutoff: { created: CUTOFF_CREATED, id: CUTOFF_ID },
  automatic_schema_version: AUTOMATIC_SCHEMA_VERSION,
  automatic_agent_id: AUTOMATIC_AGENT_ID,
  integrity_hash: `hash:${POLICY_VERSION}|${CUTOFF_CREATED}|${CUTOFF_ID}|${AUTOMATIC_SCHEMA_VERSION}|${AUTOMATIC_AGENT_ID}`,
}
const parameter = new MockRecord('com_parametros', 'parameter-current-flow', {
  chave: 'nexo.curadoria.fluxo_corrente_v1',
  valor: JSON.stringify(policy),
  ativo: true,
  tipo: 'json_imutavel',
  versao: 1,
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
  new MockRecord('com_ledger_comercial', 'ledger-sensitive-without-external-ref', {
    fonte: 'nexo_app',
    canal: 'Ajuda do Nexo',
    tipo_evento: 'mensagem',
    fato: 'Relato de possível vazamento de dados pessoais exige avaliação executiva.',
    evidencia_ref: '',
    destino_sugerido: 'curadoria',
    risco: 'alto',
    confianca: 'baixa',
    occurred_at: '2026-10-01 14:30:00.000Z',
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
        created: `2026-09-30 ${15 + index}:00:00.000Z`,
        status: 'novo',
      }),
  ),
]

const collections = {
  com_perfis: [profile, executiveProfile],
  com_parametros: [parameter],
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
  findFirstRecordByData(collection, field, value) {
    const rec = rowsFor(collection).find((row) => row.getString(field) === value)
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
      if (name === 'com_nexo_curadoria_casos' && !record.getString('created'))
        record.set('created', '2026-10-02 00:00:00.000Z')
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
  $security: {
    sha256: (value) =>
      String(value).includes('\n')
        ? crypto.createHash('sha256').update(String(value), 'utf8').digest('hex')
        : `hash:${value}`,
  },
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
assert.equal(dryRun.payload.casos_novos, 3, 'matéria sensível entra imediatamente')
assert.equal(dryRun.payload.evidencias_novas, 3)
assert.deepEqual(dryRun.payload.classification_counts, {
  ledger_records: {
    discarded_noise: 0,
    operational_history: 0,
  },
  consolidated_groups: {
    hypothesis_waiting_evidence: 1,
    automatic_promotion: 0,
    management_exception: 0,
    direction_exception: 3,
  },
})
assert.deepEqual(dryRun.payload.guardrails, {
  no_mutation: true,
  no_send: true,
  no_publication: true,
})
assert.deepEqual(
  dryRun.payload.historical_snapshot,
  {
    count: 6,
    period_start: '2026-09-28 12:00:00.000Z',
    period_end: '2026-10-01 17:00:00.000Z',
    sha256: '7429b0747a243f392ed91480dbd22770b33ab654906fa9e0a09f589a88e6e3b7',
    canonicalization: 'id|occurred_at\\n sorted by id; UTF-8; no trailing newline',
  },
  'dry-run deve expor apenas prova sanitizada do passivo histórico',
)
assert.equal(JSON.stringify(dryRun.payload).includes('Cliente A'), false)
assert.match(dryRun.payload.historical_snapshot.sha256, /^[a-f0-9]{64}$/)
assert.equal(
  dryRun.payload.historical_snapshot.count,
  dryRun.payload.historical_untouched,
  'count da prova sanitizada deve coincidir com historical_untouched',
)
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
assert.equal(applied.payload.casos_criados, 3)
assert.equal(applied.payload.evidencias_criadas, 3)
assert.equal(applied.payload.transicoes_criadas, 3)
assert.equal(collections.com_nexo_curadoria_casos.length, 3)
assert.equal(collections.com_nexo_curadoria_evidencias.length, 3)
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
  created: '2026-10-01 00:00:00.000Z',
})
collections.com_nexo_curadoria_casos.push(legacyPreferenceCase)

// The immutable cutoff keeps the initial historical recurrence inputs out of the first pass.
// Move those same fixture records into the current-flow window for the recurrence scenario below.
ledger[0].set('created', '2026-10-02 08:00:00.000Z')
ledger[1].set('created', '2026-10-02 08:01:00.000Z')
ledger[2].set('created', '2026-10-02 08:02:00.000Z')

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
      created: '2026-10-01 00:00:00.000Z',
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

const n2AdditionalRows = []
for (let index = 1; index <= 3; index++) {
  n2AdditionalRows.push(
    new MockRecord('com_ledger_comercial', `n2-no-team-${index}`, {
      fonte: 'nexo_app',
      canal: 'Ajuda do Nexo',
      empresa_nome: `Empresa sem equipe ${index}`,
      negocio_ref: `OE-N2-SEM-EQUIPE-${index}`,
      tipo_evento: 'alinhamento_organizacional_n2',
      fato: 'Alinhamento operacional recorrente requer definição da equipe responsável.',
      evidencia_ref: `event-n2-no-team-${index}`,
      destino_sugerido: 'curadoria',
      risco: 'baixo',
      confianca: 'alta',
      occurred_at: `2026-10-03 1${index}:00:00.000Z`,
      created: `2026-10-03 1${index}:00:00.000Z`,
      status: 'novo',
    }),
    new MockRecord('com_ledger_comercial', `n2-management-${index}`, {
      fonte: 'nexo_app',
      canal: 'Ajuda do Nexo',
      empresa_nome: `Empresa gestão ${index}`,
      negocio_ref: `OE-N2-GESTAO-${index}`,
      equipe_id: 'equipe-n2',
      tipo_evento: 'roteiro_comercial_n2',
      fato: 'Roteiro comercial recorrente precisa de alinhamento da gestão.',
      evidencia_ref: `event-n2-management-${index}`,
      destino_sugerido: 'curadoria',
      risco: 'baixo',
      confianca: 'alta',
      occurred_at: `2026-10-03 2${index}:00:00.000Z`,
      created: `2026-10-03 2${index}:00:00.000Z`,
      status: 'novo',
    }),
    new MockRecord('com_ledger_comercial', `n2-no-team-automatic-${index}`, {
      fonte: 'nexo_app',
      canal: 'Ajuda do Nexo',
      empresa_nome: `Empresa automática sem equipe ${index}`,
      negocio_ref: `OE-N2-AUTO-SEM-EQUIPE-${index}`,
      tipo_evento: 'rotina_sem_equipe_n2',
      fato: 'Rotina recorrente é coerente, mas ainda não possui equipe responsável.',
      evidencia_ref: `event-n2-no-team-automatic-${index}`,
      destino_sugerido: 'historico',
      risco: 'baixo',
      confianca: 'alta',
      promocao_modo: 'promover_baixo_risco',
      occurred_at: `2026-10-04 1${index}:00:00.000Z`,
      created: `2026-10-04 1${index}:00:00.000Z`,
      status: 'novo',
    }),
    new MockRecord('com_ledger_comercial', `n2-team-automatic-${index}`, {
      fonte: 'nexo_app',
      canal: 'Ajuda do Nexo',
      empresa_nome: `Empresa automática com equipe ${index}`,
      negocio_ref: `OE-N2-AUTO-EQUIPE-${index}`,
      equipe_id: 'equipe-automatica-n2',
      tipo_evento: 'rotina_automatica_n2',
      fato: 'Rotina recorrente, coerente e reversível com equipe responsável.',
      evidencia_ref: `event-n2-team-automatic-${index}`,
      destino_sugerido: 'historico',
      risco: 'baixo',
      confianca: 'alta',
      promocao_modo: 'promover_baixo_risco',
      occurred_at: `2026-10-04 2${index}:00:00.000Z`,
      created: `2026-10-04 2${index}:00:00.000Z`,
      status: 'novo',
    }),
  )
}
n2AdditionalRows.push(
  new MockRecord('com_ledger_comercial', 'n2-operational-history', {
    fonte: 'nexo_app',
    canal: 'Ajuda do Nexo',
    empresa_nome: 'Empresa histórico operacional',
    negocio_ref: 'OE-N2-HISTORICO',
    equipe_id: 'equipe-n2',
    tipo_evento: 'historico_operacional_n2',
    fato: 'Registro factual concluído sem proposta de orientação operacional.',
    evidencia_ref: 'event-n2-operational-history',
    destino_sugerido: 'historico',
    risco: 'baixo',
    confianca: 'alta',
    promocao_modo: '',
    occurred_at: '2026-10-03 23:00:00.000Z',
    created: '2026-10-03 23:00:00.000Z',
    status: 'novo',
  }),
)
ledger.push(...n2AdditionalRows)

const n2MatrixPreview = invoke({ dry_run: true })
assert.equal(n2MatrixPreview.status, 200)
assert.equal(n2MatrixPreview.payload.casos_novos, 4)
assert.equal(n2MatrixPreview.payload.evidencias_novas, 12)
assert.equal(n2MatrixPreview.payload.classification_counts.ledger_records.operational_history, 1)
assert(n2MatrixPreview.payload.classification_counts.consolidated_groups.management_exception >= 1)
assert(n2MatrixPreview.payload.classification_counts.consolidated_groups.direction_exception >= 5)

const n2MatrixApply = invoke({
  dry_run: false,
  confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
})
assert.equal(n2MatrixApply.status, 200)
assert.equal(n2MatrixApply.payload.casos_criados, 4)
assert.equal(n2MatrixApply.payload.evidencias_criadas, 12)
const organizationCase = collections.com_nexo_curadoria_casos.find(
  (item) => item.getString('assunto_chave') === 'alinhamento_organizacional_n2',
)
assert(organizationCase, 'ausência de equipe deve consolidar um caso organizacional')
assert.equal(organizationCase.getString('escopo_tipo'), 'organizacao')
assert.equal(organizationCase.getString('escopo_ref'), 'organizacao')
assert.equal(organizationCase.getString('equipe_id'), '')
assert.equal(organizationCase.getString('alcada'), 'direcao')
assert.equal(organizationCase.getString('status'), 'aguardando_direcao')
const automaticWithoutTeamCase = collections.com_nexo_curadoria_casos.find(
  (item) => item.getString('assunto_chave') === 'rotina_sem_equipe_n2',
)
assert(
  automaticWithoutTeamCase,
  'candidato automático sem equipe deve falhar fechado para a direção',
)
assert.equal(automaticWithoutTeamCase.getString('escopo_tipo'), 'organizacao')
assert.equal(automaticWithoutTeamCase.getString('alcada'), 'direcao')
assert.equal(automaticWithoutTeamCase.getBool('automatic_promotion_allowed'), false)
const automaticTeamCase = collections.com_nexo_curadoria_casos.find(
  (item) => item.getString('assunto_chave') === 'rotina_automatica_n2',
)
assert(automaticTeamCase, 'candidato automático governado deve materializar caso aprovado')
assert.equal(automaticTeamCase.getString('status'), 'aprovado')
assert.equal(automaticTeamCase.getString('conhecimento_status'), 'pendente_publicacao')
collections.com_nexo_curadoria_casos.push(
  new MockRecord('com_nexo_curadoria_casos', 'active-automatic-conflict', {
    fingerprint: 'active-automatic-conflict-fingerprint',
    recorrencia_chave: automaticTeamCase.getString('recorrencia_chave'),
    status: 'aprovado',
    conhecimento_status: 'ativo',
    created: '2026-09-29 09:00:00.000Z',
  }),
)
const directionEscalationPreview = invoke({ dry_run: true })
assert.equal(directionEscalationPreview.status, 200)
assert.equal(
  directionEscalationPreview.payload.casos_atualizados,
  1,
  'dry-run must project direction escalation even without new evidence',
)
const directionEscalationApply = invoke({
  dry_run: false,
  confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
})
assert.equal(directionEscalationApply.status, 200)
assert.equal(directionEscalationApply.payload.casos_atualizados, 1)
assert.equal(directionEscalationApply.payload.evidencias_criadas, 0)
assert.equal(automaticTeamCase.getString('status'), 'aguardando_direcao')
assert.equal(automaticTeamCase.getString('alcada'), 'direcao')
const directionEscalationTransition = collections.com_nexo_curadoria_transicoes.find(
  (item) =>
    item.getString('caso_id') === automaticTeamCase.id &&
    item.get('metadados').gatilho === 'escalada_direcao_n2',
)
assert(directionEscalationTransition, 'direction escalation must create an audited transition')
assert.match(directionEscalationTransition.getString('motivo'), /alçada executiva/i)
const managementCase = collections.com_nexo_curadoria_casos.find(
  (item) => item.getString('assunto_chave') === 'roteiro_comercial_n2',
)
assert(managementCase, 'recorrência comum com sinal humano deve consolidar uma exceção')
assert.equal(managementCase.getString('alcada'), 'gestao_comercial')
assert.equal(managementCase.getString('status'), 'aberto_curadoria')
managementCase.set('status', 'aprovado')
managementCase.set('conhecimento_status', 'ativo')
managementCase.set('validado_por', 'manager-n2')
managementCase.set('approved_at', '2026-10-04 20:00:00.000Z')
const managementRevisionBeforeConflict = managementCase.getInt('revisao')
ledger.push(
  new MockRecord('com_ledger_comercial', 'n2-management-structured-conflict', {
    fonte: 'reuniao',
    canal: 'Reunião comercial',
    empresa_nome: 'Empresa gestão conflito',
    negocio_ref: 'OE-N2-GESTAO-CONFLITO',
    equipe_id: 'equipe-n2',
    tipo_evento: 'roteiro_comercial_n2',
    fato: 'A orientação recorrente entrou em contradição material com regra autorizada.',
    revisao_status: 'contradicao_material',
    evidencia_ref: 'event-n2-management-structured-conflict',
    destino_sugerido: 'curadoria',
    risco: 'baixo',
    confianca: 'alta',
    occurred_at: '2026-10-05 12:00:00.000Z',
    created: '2026-10-05 12:00:00.000Z',
    status: 'novo',
  }),
)
const escalatedManagementCase = invoke({
  dry_run: false,
  confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
})
assert.equal(escalatedManagementCase.status, 200)
assert.equal(escalatedManagementCase.payload.casos_criados, 0)
assert.equal(escalatedManagementCase.payload.casos_atualizados, 1)
assert.equal(managementCase.getString('status'), 'aguardando_direcao')
assert.equal(managementCase.getString('alcada'), 'direcao')
assert.equal(managementCase.getString('risco_classe'), 'alto')
assert.equal(managementCase.getBool('human_review_required'), true)
assert.equal(managementCase.getBool('automatic_promotion_allowed'), false)
assert.equal(managementCase.getInt('revisao'), managementRevisionBeforeConflict + 1)
assert.equal(managementCase.getString('conhecimento_status'), 'revisao_necessaria')
assert.equal(
  collections.com_nexo_curadoria_casos.some(
    (item) => item.getString('assunto_chave') === 'historico_operacional_n2',
  ),
  false,
  'histórico operacional não deve materializar caso',
)

for (let index = 1; index <= 3; index++) {
  ledger.push(
    new MockRecord('com_ledger_comercial', `n2-ambiguous-business-${index}`, {
      fonte: 'nexo_app',
      canal: 'Ajuda do Nexo',
      empresa_nome: 'Empresa com referência divergente',
      negocio_id: 'same-business-id',
      negocio_ref: `OE-ALIAS-${index}`,
      equipe_id: 'equipe-ambigua',
      tipo_evento: 'padrao_alias_n2',
      fato: 'Mesmo negócio apareceu com referências comerciais divergentes.',
      evidencia_ref: `event-n2-ambiguous-${index}`,
      destino_sugerido: 'historico',
      risco: 'baixo',
      confianca: 'alta',
      promocao_modo: 'promover_baixo_risco',
      occurred_at: `2026-10-06 1${index}:00:00.000Z`,
      created: `2026-10-06 1${index}:00:00.000Z`,
      status: 'novo',
    }),
  )
}
const ambiguousBusinessPreview = invoke({ dry_run: true })
assert.equal(ambiguousBusinessPreview.status, 200)
assert.equal(ambiguousBusinessPreview.payload.casos_novos, 0)
const ambiguousBusinessApply = invoke({
  dry_run: false,
  confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
})
assert.equal(ambiguousBusinessApply.status, 200)
assert.equal(ambiguousBusinessApply.payload.casos_criados, 0)
assert.equal(
  collections.com_nexo_curadoria_casos.some(
    (item) => item.getString('assunto_chave') === 'padrao_alias_n2',
  ),
  false,
  'aliases divergentes do mesmo negócio não comprovam recorrência independente',
)

for (let index = 1; index <= 3; index++) {
  ledger.push(
    new MockRecord('com_ledger_comercial', `n2-shared-alias-${index}`, {
      fonte: 'nexo_app',
      canal: 'Ajuda do Nexo',
      empresa_nome: `Empresa com ID canônico ${index}`,
      negocio_id: `canonical-business-${index}`,
      negocio_ref: 'OE-SHARED-ALIAS',
      equipe_id: 'equipe-alias-compartilhado',
      tipo_evento: 'padrao_alias_compartilhado_n2',
      fato: 'Negócios distintos compartilham uma referência legada não canônica.',
      evidencia_ref: `event-n2-shared-alias-${index}`,
      destino_sugerido: 'historico',
      risco: 'baixo',
      confianca: 'alta',
      promocao_modo: 'promover_baixo_risco',
      occurred_at: `2026-10-06 2${index}:00:00.000Z`,
      created: `2026-10-06 2${index}:00:00.000Z`,
      status: 'novo',
    }),
  )
}
ledger.push(
  new MockRecord('com_ledger_comercial', 'n2-shared-alias-without-canonical-id', {
    fonte: 'nexo_app',
    canal: 'Ajuda do Nexo',
    empresa_nome: 'Empresa sem ID em alias ambíguo',
    negocio_ref: 'OE-SHARED-ALIAS',
    equipe_id: 'equipe-alias-compartilhado',
    tipo_evento: 'padrao_alias_compartilhado_n2',
    fato: 'Referência ambígua sem ID canônico não comprova um novo escopo independente.',
    evidencia_ref: 'event-n2-shared-alias-without-id',
    destino_sugerido: 'historico',
    risco: 'baixo',
    confianca: 'alta',
    promocao_modo: 'promover_baixo_risco',
    occurred_at: '2026-10-06 23:30:00.000Z',
    created: '2026-10-06 23:30:00.000Z',
    status: 'novo',
  }),
)
const sharedAliasPreview = invoke({ dry_run: true })
assert.equal(sharedAliasPreview.status, 200)
assert.equal(sharedAliasPreview.payload.casos_novos, 1)
assert.equal(sharedAliasPreview.payload.evidencias_novas, 3)
const sharedAliasApply = invoke({
  dry_run: false,
  confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
})
assert.equal(sharedAliasApply.status, 200)
assert.equal(sharedAliasApply.payload.casos_criados, 1)
const sharedAliasCase = collections.com_nexo_curadoria_casos.find(
  (item) => item.getString('assunto_chave') === 'padrao_alias_compartilhado_n2',
)
assert(sharedAliasCase, 'IDs canônicos distintos devem contar como escopos independentes')
assert.equal(sharedAliasCase.getString('status'), 'aprovado')
assert.equal(sharedAliasCase.getInt('recorrencia_contagem'), 3)

const protectedContentSamples = [
  `Contato: pessoa${'@'}example.test`,
  'Telefone: (81) 99999-0000',
  'CPF: 123.456.789-00',
  `Credencial: access_${'token'}=sample-value`,
  `Credencial: api_${'key'}=sample-value`,
  `Token: gh${'p_'}${'a'.repeat(24)}`,
  `Token: github_${'pat_'}${'h'.repeat(24)}`,
  `Token: sk-${'proj-'}${'b'.repeat(24)}`,
  `Chave: AKIA${'C'.repeat(16)}`,
  `${'AWS_'}${'SECRET_ACCESS_KEY'}=${'i'.repeat(40)}`,
  `${'AWS_'}${'SESSION_TOKEN'}=${'j'.repeat(40)}`,
  `${'Author'}${'ization'}: ${'Bear'}${'er'} ${'d'.repeat(24)}`,
  `JWT: eyJ${'e'.repeat(12)}.${'f'.repeat(12)}.${'g'.repeat(12)}`,
  `-----BEGIN ${'private key'}-----`,
]
for (let index = 0; index < protectedContentSamples.length; index++) {
  ledger.push(
    new MockRecord('com_ledger_comercial', `n2-protected-content-${index}`, {
      fonte: 'nexo_app',
      canal: 'Ajuda do Nexo',
      empresa_nome: `Empresa conteúdo protegido ${index}`,
      negocio_ref: `OE-N2-PROTECTED-${index}`,
      equipe_id: 'equipe-protegida',
      tipo_evento: 'conteudo_protegido_n2',
      fato: protectedContentSamples[index],
      evidencia_ref: `event-n2-protected-${index}`,
      destino_sugerido: 'historico',
      risco: 'baixo',
      confianca: 'alta',
      promocao_modo: 'promover_baixo_risco',
      occurred_at: `2026-10-07 1${index}:00:00.000Z`,
      created: `2026-10-07 1${index}:00:00.000Z`,
      status: 'novo',
    }),
  )
}
const protectedContentPreview = invoke({ dry_run: true })
assert.equal(protectedContentPreview.status, 200)
assert.equal(protectedContentPreview.payload.casos_novos, protectedContentSamples.length)
assert(
  protectedContentPreview.payload.classification_counts.consolidated_groups.direction_exception >=
    protectedContentSamples.length,
)
const protectedContentApply = invoke({
  dry_run: false,
  confirmacao: 'APLICAR_CONSOLIDACAO_CURADORIA_COMERCIAL',
})
assert.equal(protectedContentApply.status, 200)
assert.equal(protectedContentApply.payload.casos_criados, protectedContentSamples.length)
const protectedContentCases = collections.com_nexo_curadoria_casos.filter(
  (item) => item.getString('assunto_chave') === 'conteudo_protegido_n2',
)
assert.equal(protectedContentCases.length, protectedContentSamples.length)
assert(protectedContentCases.every((item) => item.getString('alcada') === 'direcao'))
assert(protectedContentCases.every((item) => !item.getBool('automatic_promotion_allowed')))

console.log('nexo-curadoria-casos-consolidar runtime: PASS')
