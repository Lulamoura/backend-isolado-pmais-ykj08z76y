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
  get(name) {
    return this.values[name]
  }
  set(name, value) {
    this.values[name] = value
  }
}

const managerProfile = new MockRecord('com_perfis', 'profile-manager', {
  ativo: true,
  slug: 'gestor-comercial',
})
const executiveProfile = new MockRecord('com_perfis', 'profile-executive', {
  ativo: true,
  slug: 'leitura-executiva',
})
const superadminProfile = new MockRecord('com_perfis', 'profile-superadmin', {
  ativo: true,
  slug: 'superadministrador',
})
const approverProfile = new MockRecord('com_perfis', 'profile-approver', {
  ativo: true,
  slug: 'aprovador',
})
const inactiveProfile = new MockRecord('com_perfis', 'profile-inactive', {
  ativo: false,
  slug: 'gestor-comercial',
})
const manager = new MockRecord('users', 'manager-1', {
  ativo_comercial: true,
  perfil_id: managerProfile.id,
  equipe_id: 'team-1',
})
const executive = new MockRecord('users', 'executive-1', {
  ativo_comercial: true,
  perfil_id: executiveProfile.id,
})
const superadmin = new MockRecord('users', 'superadmin-1', {
  ativo_comercial: true,
  perfil_id: superadminProfile.id,
})
const approver = new MockRecord('users', 'approver-1', {
  ativo_comercial: true,
  perfil_id: approverProfile.id,
})
const inactiveUser = new MockRecord('users', 'inactive-user', {
  ativo_comercial: false,
  perfil_id: managerProfile.id,
})
const inactiveProfileUser = new MockRecord('users', 'inactive-profile-user', {
  ativo_comercial: true,
  perfil_id: inactiveProfile.id,
})
const missingProfileUser = new MockRecord('users', 'missing-profile-user', {
  ativo_comercial: true,
  perfil_id: 'missing-profile',
})
const integrationIdentity = new MockRecord('_externalAuths', 'integration-1', {
  ativo_comercial: true,
  perfil_id: '',
})

const cases = [
  new MockRecord('com_nexo_curadoria_casos', 'case-management', {
    fingerprint: 'secret-fingerprint-1',
    revisao: 1,
    status: 'aberto_curadoria',
    fonte_principal: 'whatsapp_uazapi',
    fontes: ['whatsapp_uazapi', 'nexo_app'],
    empresa_nome: 'Cliente A',
    contato_nome: 'Contato A',
    negocio_numero: 'OE-501',
    negocio_titulo: 'Serviço recorrente',
    responsavel_nome: 'Equipe 1',
    responsavel_id: 'manager-1',
    equipe_id: 'team-1',
    negocio_id: 'business-501',
    assunto_chave: 'preferencia_comunicacao',
    titulo: 'Preferência de comunicação',
    resumo_factual: 'Cliente prefere resumo objetivo.',
    motivo_curadoria: 'Há recorrência em duas fontes.',
    evidencia_contagem: 2,
    recorrencia_contagem: 2,
    evidencia_hashes: ['internal-hash-1'],
    risco_classe: 'medio',
    alcada: 'gestao_comercial',
    sensivel_motivos: [],
    confianca: 'media',
    human_review_required: true,
    automatic_promotion_allowed: false,
    conhecimento_status: 'nao_publicado',
    last_seen_at: '2026-10-01 12:00:00.000Z',
  }),
  new MockRecord('com_nexo_curadoria_casos', 'case-sensitive', {
    fingerprint: 'secret-fingerprint-2',
    revisao: 1,
    status: 'aguardando_direcao',
    fonte_principal: 'whatsapp_uazapi',
    fontes: ['whatsapp_uazapi'],
    empresa_nome: 'Cliente B',
    negocio_numero: 'OE-502',
    assunto_chave: 'preco_ou_desconto',
    titulo: 'Preço ou desconto — decisão executiva',
    resumo_factual: 'Cliente pediu desconto.',
    motivo_curadoria: 'Matéria sensível.',
    evidencia_contagem: 1,
    recorrencia_contagem: 1,
    evidencia_hashes: ['internal-hash-2'],
    risco_classe: 'alto',
    alcada: 'direcao',
    sensivel_motivos: ['preco_ou_desconto'],
    confianca: 'media',
    human_review_required: true,
    automatic_promotion_allowed: false,
    conhecimento_status: 'nao_publicado',
    last_seen_at: '2026-10-01 13:00:00.000Z',
  }),
  new MockRecord('com_nexo_curadoria_casos', 'case-approved', {
    revisao: 3,
    status: 'aprovado',
    fonte_principal: 'atividade_comercial',
    fontes: ['atividade_comercial'],
    empresa_nome: 'Cliente C',
    negocio_numero: 'OE-503',
    assunto_chave: 'reuniao',
    titulo: 'Aprendizado de reunião',
    resumo_factual: 'Padrão validado.',
    motivo_curadoria: 'Orientação aprovada.',
    regra_candidata: 'Registrar decisor e prazo após a reunião.',
    evidencia_contagem: 3,
    recorrencia_contagem: 2,
    risco_classe: 'medio',
    alcada: 'gestao_comercial',
    sensivel_motivos: [],
    confianca: 'alta',
    conhecimento_status: 'ativo',
    last_seen_at: '2026-09-30 12:00:00.000Z',
  }),
  new MockRecord('com_nexo_curadoria_casos', 'case-rejected', {
    revisao: 2,
    status: 'rejeitado',
    fonte_principal: 'nexo_app',
    fontes: ['nexo_app'],
    empresa_nome: 'Cliente D',
    negocio_numero: 'OE-504',
    assunto_chave: 'sinal_comercial',
    titulo: 'Sinal comercial para curadoria',
    resumo_factual: 'Sinal não confirmado.',
    motivo_curadoria: 'Baixa confiança.',
    evidencia_contagem: 1,
    recorrencia_contagem: 1,
    risco_classe: 'medio',
    alcada: 'gestao_comercial',
    sensivel_motivos: [],
    confianca: 'baixa',
    conhecimento_status: 'nao_publicado',
    last_seen_at: '2026-09-29 12:00:00.000Z',
  }),
  new MockRecord('com_nexo_curadoria_casos', 'case-sensitive-open', {
    revisao: 1,
    status: 'aberto_curadoria',
    fonte_principal: 'activecampaign',
    fontes: ['activecampaign'],
    empresa_nome: 'Cliente E',
    negocio_numero: 'OE-505',
    assunto_chave: 'politica_comercial',
    titulo: 'Condição comercial sensível identificada',
    resumo_factual: 'Foi identificada recorrência que envolve política comercial.',
    motivo_curadoria: 'A direção precisa validar a orientação antes do uso.',
    evidencia_contagem: 2,
    recorrencia_contagem: 2,
    risco_classe: 'alto',
    alcada: 'direcao',
    sensivel_motivos: ['politica_comercial'],
    confianca: 'media',
    human_review_required: true,
    automatic_promotion_allowed: false,
    conhecimento_status: 'nao_publicado',
    last_seen_at: '2026-10-01 14:00:00.000Z',
  }),
  new MockRecord('com_nexo_curadoria_casos', 'case-out-of-scope', {
    fingerprint: 'secret-fingerprint-out-of-scope',
    revisao: 1,
    status: 'aberto_curadoria',
    fonte_principal: 'activecampaign',
    fontes: ['activecampaign'],
    empresa_nome: 'Cliente fora do escopo',
    negocio_numero: 'OE-999',
    responsavel_nome: 'Outra equipe',
    responsavel_id: 'owner-9',
    equipe_id: 'team-9',
    negocio_id: 'business-999',
    assunto_chave: 'preferencia_comunicacao',
    titulo: 'Caso fora do escopo',
    resumo_factual: 'Não pertence à equipe do gestor.',
    motivo_curadoria: 'Exige isolamento de escopo.',
    evidencia_contagem: 1,
    recorrencia_contagem: 1,
    risco_classe: 'medio',
    alcada: 'gestao_comercial',
    sensivel_motivos: [],
    confianca: 'media',
    human_review_required: true,
    automatic_promotion_allowed: false,
    conhecimento_status: 'nao_publicado',
    last_seen_at: '2026-10-01 15:00:00.000Z',
  }),
  new MockRecord('com_nexo_curadoria_casos', 'case-substituted', {
    fingerprint: 'secret-fingerprint-substituted',
    revisao: 1,
    status: 'aberto_curadoria',
    fonte_principal: 'atividade_comercial',
    fontes: ['atividade_comercial'],
    empresa_nome: 'Cliente substituído',
    negocio_numero: 'OE-777',
    responsavel_nome: 'Titular ausente',
    responsavel_id: 'owner-away',
    equipe_id: 'team-7',
    negocio_id: 'business-777',
    assunto_chave: 'reuniao',
    titulo: 'Caso coberto por substituição',
    resumo_factual: 'Gestor cobre o titular neste negócio.',
    motivo_curadoria: 'Cobertura temporária vigente.',
    evidencia_contagem: 1,
    recorrencia_contagem: 1,
    risco_classe: 'medio',
    alcada: 'gestao_comercial',
    sensivel_motivos: [],
    confianca: 'media',
    human_review_required: true,
    automatic_promotion_allowed: false,
    conhecimento_status: 'nao_publicado',
    last_seen_at: '2026-10-01 14:30:00.000Z',
  }),
]

const profiles = [
  managerProfile,
  executiveProfile,
  superadminProfile,
  approverProfile,
  inactiveProfile,
]
const transitions = []
const outbox = []
let nextId = 1
const collections = {
  com_perfis: profiles,
  com_nexo_curadoria_casos: cases,
  com_nexo_curadoria_transicoes: transitions,
  com_nexo_curadoria_outbox: outbox,
  com_ledger_comercial: [],
  com_nexo_curadoria_evidencias: [],
  com_nexo_curadoria_outbox_auditoria: [],
  com_substituicoes: [
    new MockRecord('com_substituicoes', 'substitution-1', {
      titular_id: 'owner-away',
      substituto_principal_id: 'manager-1',
      substituto_reserva_id: '',
      tipo_cobertura: 'por_negocios',
      negocios_cobertos: ['business-777'],
      data_inicio: '2026-01-01',
      data_fim: '2027-01-01',
      cancelada_em: '',
    }),
  ],
}

const app = {
  findRecordById(collection, id) {
    const record = (collections[collection] || []).find((row) => row.id === id)
    if (!record) throw new Error('not found')
    if (collection === 'com_nexo_curadoria_casos' && gatewayMode === 'supersede_before_http') {
      const claimed = outbox.find((row) => row.getString('status') === 'processando')
      if (claimed) {
        claimed.set('status', 'supersedido')
        claimed.set('superseded_by', 'interleaving-before-http')
      }
      gatewayMode = 'success'
    }
    return record
  },
  findRecordsByFilter(collection, _filter, _sort, limit, offset) {
    const rows = collections[collection] || []
    return rows.slice(offset || 0, (offset || 0) + (limit || rows.length))
  },
  findCollectionByNameOrId(name) {
    return { name }
  },
  save(record) {
    const name = record.collection.name || record.collection
    if (!record.id) {
      record.id = `transition-${nextId++}`
      collections[name].push(record)
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
const gatewayCalls = []
let gatewayMode = 'success'
let concurrentOutboxResult = null
const requestedSecrets = []
const context = {
  console,
  Date,
  JSON,
  Math,
  Record: RecordCtor,
  $app: app,
  $os: { getenv: () => '' },
  $http: {
    send: (request) => {
      gatewayCalls.push(request)
      const payload = JSON.parse(request.body)
      if (gatewayMode === 'concurrent') {
        gatewayMode = 'success'
        concurrentOutboxResult = invokeOutbox(superadmin)
      }
      if (gatewayMode === 'supersede_during_http') {
        const current = outbox.find(
          (row) =>
            row.getString('status') === 'processando' &&
            row.get('payload_json')?.knowledge_ref === payload.knowledge_ref,
        )
        current.set('status', 'supersedido')
        current.set('superseded_by', 'nova-revisao-durante-http')
      }
      if (gatewayMode === 'revision_during_http') {
        const currentCase = cases.find((row) => row.id === 'case-management')
        currentCase.set('revisao', currentCase.getInt('revisao') + 1)
      }
      if (gatewayMode === 'invalid') {
        return { statusCode: 503, json: { ok: false }, raw: '' }
      }
      if (gatewayMode === 'mismatch') {
        return {
          statusCode: 200,
          json: {
            ok: true,
            audit_id: `audit-${payload.case_revision}`,
            version: `version-${payload.case_revision}`,
            payload_hash: request.headers['x-pmais-payload-hash'],
            readback_confirmed: true,
            knowledge_ref: payload.knowledge_ref,
            approval_id: 'approval-divergente',
          },
          raw: '',
        }
      }
      const actor = {
        actor_id: payload.approval.actor_id,
        actor_profile: payload.approval.actor_profile,
        authority: payload.approval.authority,
        app_id: payload.approval.app_id,
      }
      if (gatewayMode === 'scope_mismatch') actor.actor_id = 'outro-ator'
      return {
        statusCode: 200,
        json: {
          ok: true,
          audit_id: `audit-${payload.case_revision}`,
          version: `version-${payload.case_revision}`,
          payload_hash: request.headers['x-pmais-payload-hash'],
          readback_confirmed: true,
          knowledge_ref: payload.knowledge_ref,
          approval_id: payload.approval.approval_id,
          action: payload.action,
          case_revision: payload.case_revision,
          actor,
        },
        raw: '',
      }
    },
  },
  $security: {
    sha256: (value) => `hash:${value}`,
    hs256: (value, secret) => `signature:${secret}:${value}`,
  },
  $secrets: {
    get: (name) => {
      requestedSecrets.push(name)
      if (name === 'PMAIS_AGENT_GATEWAY_URL') return 'https://gateway.example.test'
      if (name === 'PMAIS_CURADORIA_API_KEY') return 'protected-api-key'
      if (name === 'PMAIS_CURADORIA_HMAC_SECRET') return 'protected-hmac-secret'
      if (name === 'PMAIS_CURADORIA_APPROVAL_SECRET') return 'protected-approval-secret'
      return ''
    },
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
vm.runInContext(
  fs.readFileSync('pocketbase/hooks/com_nexo_central_operacional.js', 'utf8'),
  context,
)

const listRoute = routes['POST /backend/v1/nexo/curadoria/casos/listar']
const transitionRoute = routes['POST /backend/v1/nexo/curadoria/casos/{id}/transicionar']
const processOutboxRoute = routes['POST /backend/v1/nexo/curadoria/outbox/processar']
const retryOutboxRoute = routes['POST /backend/v1/nexo/curadoria/outbox/{id}/retry']
assert(listRoute, 'rota backend de listagem da Curadoria deve existir')
assert(transitionRoute, 'rota backend de transição da Curadoria deve existir')
assert(processOutboxRoute, 'rota governada de processamento da outbox deve existir')
assert(retryOutboxRoute, 'rota administrativa de retry da outbox deve existir')

function invokeList(auth) {
  let response = null
  const e = {
    auth,
    requestInfo: () => ({ body: { limite: 50 } }),
    json(status, payload) {
      response = { status, payload }
      return response
    },
    forbiddenError(message) {
      response = { status: 403, payload: { message } }
      return response
    },
  }
  listRoute(e)
  return response
}

function invokeTransition(auth, id, body) {
  let response = null
  const e = {
    auth,
    request: { pathValue: () => id },
    requestInfo: () => ({ body }),
    json(status, payload) {
      response = { status, payload }
      return response
    },
    forbiddenError(message) {
      response = { status: 403, payload: { message } }
      return response
    },
  }
  transitionRoute(e)
  return response
}

function invokeOutbox(auth) {
  let response = null
  const e = {
    auth,
    requestInfo: () => ({ body: { limite: 10 } }),
    json(status, payload) {
      response = { status, payload }
      return response
    },
    forbiddenError(message) {
      response = { status: 403, payload: { message } }
      return response
    },
  }
  processOutboxRoute(e)
  return response
}

function invokeRetry(auth, id, body) {
  let response = null
  const e = {
    auth,
    request: { pathValue: () => id },
    requestInfo: () => ({ body: body || {} }),
    json(status, payload) {
      response = { status, payload }
      return response
    },
    forbiddenError(message) {
      response = { status: 403, payload: { message } }
      return response
    },
  }
  retryOutboxRoute(e)
  return response
}

const managerList = invokeList(manager)
assert.equal(managerList.status, 200)
assert.equal(managerList.payload.visoes.para_tratar.length, 2)
assert.deepEqual(managerList.payload.visoes.para_tratar.map((item) => item.titulo).sort(), [
  'Caso coberto por substituição',
  'Preferência de comunicação',
])
assert.equal(
  managerList.payload.visoes.para_tratar.some((item) => item.titulo === 'Caso fora do escopo'),
  false,
)
assert.equal(managerList.payload.visoes.aguardando_decisao.length, 0)
assert.equal('fingerprint' in managerList.payload.visoes.para_tratar[0], false)
assert.equal('evidencia_hashes' in managerList.payload.visoes.para_tratar[0], false)

const executiveList = invokeList(executive)
assert.equal(executiveList.status, 200)
assert.equal(executiveList.payload.visoes.aguardando_decisao.length, 1)
assert.equal(executiveList.payload.visoes.para_tratar.length, 1)
assert.equal(executiveList.payload.visoes.para_tratar[0].id, 'case-sensitive-open')
assert.equal(executiveList.payload.visoes.conhecimento_aprovado.length, 1)
assert.equal(executiveList.payload.visoes.historico.length, 1)

for (const deniedIdentity of [
  null,
  inactiveUser,
  inactiveProfileUser,
  missingProfileUser,
  integrationIdentity,
]) {
  assert.equal(invokeList(deniedIdentity).status, 403)
}

const outOfScopeTransition = invokeTransition(manager, 'case-out-of-scope', {
  acao: 'salvar_rascunho',
  expected_revision: 1,
})
assert.equal(outOfScopeTransition.status, 403)

const sensitiveOpen = cases.find((row) => row.id === 'case-sensitive-open')
const executiveCannotWrite = invokeTransition(executive, 'case-sensitive-open', {
  acao: 'encaminhar_direcao',
  expected_revision: 1,
  entrevista_etapa: 4,
  entrevista_respostas: [
    'Submeter condições excepcionais à direção.',
    'Não se aplica a condições já previstas em contrato.',
    'A gestão registra a decisão no negócio.',
    'Encaminhar para validação executiva.',
  ],
  regra_candidata: 'Submeter condições excepcionais à direção.',
  decisao_observacao: 'Encaminhar para validação executiva.',
})
assert.equal(executiveCannotWrite.status, 403)
const approverCannotTreatDirection = invokeTransition(approver, 'case-sensitive-open', {
  acao: 'encaminhar_direcao',
  expected_revision: 1,
  entrevista_etapa: 4,
  entrevista_respostas: [
    'Submeter condições excepcionais à direção.',
    'Não se aplica a condições já previstas em contrato.',
    'A gestão registra a decisão no negócio.',
    'Encaminhar para validação executiva.',
  ],
  regra_candidata: 'Submeter condições excepcionais à direção.',
  decisao_observacao: 'Encaminhar para validação executiva.',
})
assert.equal(approverCannotTreatDirection.status, 403)
const sentToDirection = invokeTransition(superadmin, 'case-sensitive-open', {
  acao: 'encaminhar_direcao',
  expected_revision: 1,
  entrevista_etapa: 4,
  entrevista_respostas: [
    'Submeter condições excepcionais à direção.',
    'Não se aplica a condições já previstas em contrato.',
    'A gestão registra a decisão no negócio.',
    'Encaminhar para validação executiva.',
  ],
  regra_candidata: 'Submeter condições excepcionais à direção.',
  decisao_observacao: 'Encaminhar para validação executiva.',
})
assert.equal(sentToDirection.status, 200)
assert.equal(sentToDirection.payload.caso.status, 'aguardando_direcao')
assert.equal(sensitiveOpen.getInt('entrevista_etapa'), 4)
assert.equal(sensitiveOpen.get('entrevista_respostas').length, 4)
assert.equal(
  sensitiveOpen.getString('regra_candidata'),
  'Submeter condições excepcionais à direção.',
)

const draft = invokeTransition(manager, 'case-management', {
  acao: 'salvar_rascunho',
  expected_revision: 1,
  entrevista_etapa: 2,
  entrevista_respostas: ['Orientar com resumo objetivo.', 'Validar antes de enviar.'],
  regra_candidata: 'Preparar um resumo objetivo antes da reunião.',
})
assert.equal(draft.status, 200)
assert.equal(draft.payload.caso.status, 'em_entrevista')
assert.equal(draft.payload.caso.revisao, 2)
assert.equal(cases[0].getInt('entrevista_etapa'), 2)

const stale = invokeTransition(manager, 'case-management', {
  acao: 'aprovar',
  expected_revision: 1,
  regra_candidata: 'Regra desatualizada.',
})
assert.equal(stale.status, 409)

const approved = invokeTransition(manager, 'case-management', {
  acao: 'aprovar',
  expected_revision: 2,
  regra_candidata: 'Preparar um resumo objetivo antes da reunião.',
  decisao_observacao: 'Validada pela gestão comercial.',
})
assert.equal(approved.status, 200)
assert.equal(approved.payload.caso.status, 'aprovado')
assert.equal(approved.payload.caso.conhecimento_status, 'pendente_publicacao')
assert.equal(cases[0].getInt('revisao'), 3)
assert.equal(outbox.length, 1)
assert.equal(outbox[0].getString('acao'), 'publicar')
assert.equal(outbox[0].getString('status'), 'pendente')
assert.equal(outbox[0].getInt('caso_revisao'), 3)
assert.equal(outbox[0].get('payload_json').regra, 'Preparar um resumo objetivo antes da reunião.')
assert.equal('evidencia_hashes' in outbox[0].get('payload_json'), false)
assert.equal(outbox[0].get('payload_json').schema_version, 'pmais_nexo_curadoria_conhecimento_v1')
assert(outbox[0].get('payload_json').approval.approval_id)
assert.equal(outbox[0].get('payload_json').approval.actor_profile, 'curadoria')
assert.equal(outbox[0].get('payload_json').approval.authority, 'curadoria_conhecimento_comercial')
assert.equal(outbox[0].get('payload_json').approval.app_id, 'pmais_comercial')
assert.equal('human_reviewed' in outbox[0].get('payload_json'), false)
assert.equal('evidence_count' in outbox[0].get('payload_json'), false)

const approvedReplay = invokeTransition(manager, 'case-management', {
  acao: 'aprovar',
  expected_revision: 2,
  regra_candidata: 'Preparar um resumo objetivo antes da reunião.',
  decisao_observacao: 'Validada pela gestão comercial.',
})
assert.equal(approvedReplay.status, 200)
assert.equal(approvedReplay.payload.idempotent_replay, true)
assert.equal(outbox.length, 1)

const divergentReplay = invokeTransition(manager, 'case-management', {
  acao: 'aprovar',
  expected_revision: 2,
  regra_candidata: 'Regra divergente não pode reutilizar a mesma transição.',
  decisao_observacao: 'Payload divergente.',
})
assert.equal(divergentReplay.status, 409)
assert.equal(divergentReplay.payload.error, 'REPLAY_DIVERGENTE')
const approvalTransition = transitions.find(
  (row) => row.get('metadados') && row.get('metadados').acao === 'aprovar',
)
assert(
  approvalTransition.getString('command_hash'),
  'transição deve persistir o hash canônico do comando',
)

const withdrawn = invokeTransition(manager, 'case-management', {
  acao: 'retirar',
  expected_revision: 3,
  decisao_observacao: 'Orientação retirada após revisão.',
})
assert.equal(withdrawn.status, 200)
assert.equal(withdrawn.payload.caso.status, 'retirado')
assert.equal(outbox.length, 2)
assert.equal(outbox[1].getString('acao'), 'retirar')
assert.equal(outbox[1].getInt('caso_revisao'), 4)
assert.equal(outbox[0].getString('status'), 'supersedido')
assert.equal(outbox[1].getString('status'), 'pendente')

const forbiddenSensitiveApproval = invokeTransition(manager, 'case-sensitive', {
  acao: 'aprovar',
  expected_revision: 1,
  regra_candidata: 'Conceder desconto.',
})
assert.equal(forbiddenSensitiveApproval.status, 403)

const rejected = invokeTransition(superadmin, 'case-sensitive', {
  acao: 'rejeitar',
  expected_revision: 1,
  decisao_observacao: 'Não adotar regra geral de desconto.',
})
assert.equal(rejected.status, 200)
assert.equal(rejected.payload.caso.status, 'rejeitado')
assert.equal(rejected.payload.caso.revisao, 2)
assert(transitions.length >= 3)

assert.equal(invokeOutbox(manager).status, 403)
gatewayMode = 'concurrent'
const processed = invokeOutbox(superadmin)
assert.equal(processed.status, 200)
assert.equal(processed.payload.processados, 1)
assert.equal(processed.payload.falhas, 0)
assert.equal(concurrentOutboxResult.payload.processados, 0)
assert.equal(gatewayCalls.length, 1)
assert(gatewayCalls.every((call) => call.url.endsWith('/v1/comercial/nexo/curadoria/conhecimento')))
assert.equal(gatewayCalls[0].headers['x-pmais-api-key'], 'protected-api-key')
assert.equal('x-api-key' in gatewayCalls[0].headers, false)
assert(gatewayCalls[0].headers['x-pmais-approval-signature'])
const gatewayPayload = JSON.parse(gatewayCalls[0].body)
const approvalCanonical = JSON.stringify({
  action: gatewayPayload.approval.action,
  actor_id: gatewayPayload.approval.actor_id,
  actor_profile: gatewayPayload.approval.actor_profile,
  app_id: gatewayPayload.approval.app_id,
  approval_id: gatewayPayload.approval.approval_id,
  authority: gatewayPayload.approval.authority,
  case_ref: gatewayPayload.approval.case_ref,
  case_revision: gatewayPayload.approval.case_revision,
})
assert.equal(
  gatewayCalls[0].headers['x-pmais-approval-signature'],
  `signature:protected-approval-secret:${approvalCanonical}.${gatewayCalls[0].headers['x-pmais-payload-hash']}`,
  'assinatura da aprovação deve usar o JSON canônico ordenado exigido pelo Gateway',
)
assert.equal(requestedSecrets.includes('PMAIS_AGENT_GATEWAY_API_KEY'), false)
assert.equal(requestedSecrets.includes('PMAIS_AGENT_GATEWAY_HMAC_SECRET'), false)
assert.equal(outbox[0].getString('status'), 'supersedido')
assert.equal(outbox[1].getString('status'), 'processado')
assert.equal(cases[0].getString('conhecimento_status'), 'retirado')
assert.equal(cases[0].getString('conhecimento_versao'), 'version-4')

outbox[1].set('status', 'pendente')
outbox[1].set('next_attempt_at', null)
gatewayMode = 'supersede_during_http'
const supersededDuringHttp = invokeOutbox(superadmin)
assert.equal(supersededDuringHttp.payload.processados, 0)
assert.equal(outbox[1].getString('status'), 'supersedido')
assert.equal(cases[0].getString('conhecimento_status'), 'retirado')

outbox[1].set('status', 'pendente')
outbox[1].set('superseded_by', '')
outbox[1].set('tentativas', 0)
outbox[1].set('tentativas_ciclo', 0)
gatewayMode = 'invalid'
const failed = invokeOutbox(superadmin)
assert.equal(failed.status, 200)
assert.equal(failed.payload.falhas, 1)
assert.equal(failed.payload.pendentes_restantes, 1)
assert.equal(outbox[1].getString('status'), 'erro')
assert(outbox[1].getString('next_attempt_at'))
const gatewayCallsAfterFailure = gatewayCalls.length
const backedOff = invokeOutbox(superadmin)
assert.equal(backedOff.payload.processados, 0)
assert.equal(backedOff.payload.em_backoff, 1)
assert.equal(gatewayCalls.length, gatewayCallsAfterFailure)

assert.equal(invokeRetry(manager, outbox[1].id, { motivo: 'retry sem alçada' }).status, 403)
const retried = invokeRetry(superadmin, outbox[1].id, {
  motivo: 'Gateway restabelecido e incidente registrado.',
})
assert.equal(retried.status, 200)
assert.equal(outbox[1].getString('status'), 'pendente')
assert.equal(outbox[1].getInt('tentativas_ciclo'), 0)
assert.equal(collections.com_nexo_curadoria_outbox_auditoria.length, 1)
assert.equal(
  collections.com_nexo_curadoria_outbox_auditoria[0].getString('motivo'),
  'Gateway restabelecido e incidente registrado.',
)
gatewayMode = 'success'
const recovered = invokeOutbox(superadmin)
assert.equal(recovered.payload.processados, 1)
assert.equal(recovered.payload.pendentes_restantes, 0)

outbox[1].set('status', 'pendente')
outbox[1].set('next_attempt_at', null)
gatewayMode = 'mismatch'
const mismatchedReadback = invokeOutbox(superadmin)
assert.equal(mismatchedReadback.payload.processados, 0)
assert.equal(mismatchedReadback.payload.falhas, 1)
assert.equal(outbox[1].getString('status'), 'erro')
assert.match(outbox[1].getString('last_error'), /GATEWAY_READBACK_INVALIDO/)

outbox[1].set('status', 'pendente')
outbox[1].set('next_attempt_at', null)
gatewayMode = 'scope_mismatch'
const mismatchedScopeReadback = invokeOutbox(superadmin)
assert.equal(mismatchedScopeReadback.payload.processados, 0)
assert.equal(mismatchedScopeReadback.payload.falhas, 1)
assert.equal(outbox[1].getString('status'), 'erro')
assert.match(outbox[1].getString('last_error'), /GATEWAY_READBACK_INVALIDO/)

outbox[1].set('status', 'processado')
gatewayMode = 'success'
const stalePayload = {
  schema_version: 'pmais_nexo_curadoria_conhecimento_v1',
  knowledge_ref: 'stale-knowledge-ref',
  action: 'publicar',
  case_revision: 3,
  approval: {
    approval_id: 'stale-approval',
    case_ref: 'stale-knowledge-ref',
    case_revision: 3,
    actor_id: 'stale-actor',
    actor_profile: 'curadoria',
    authority: 'curadoria_conhecimento_comercial',
    action: 'publicar',
    app_id: 'pmais_comercial',
  },
}
const stalePayloadBody = JSON.stringify(stalePayload)
const staleOutbox = new MockRecord('com_nexo_curadoria_outbox', 'outbox-stale', {
  caso_id: 'case-management',
  caso_revisao: 3,
  acao: 'publicar',
  idempotency_key: 'stale-idempotency-key',
  status: 'pendente',
  tentativas: 0,
  tentativas_ciclo: 0,
  payload_json: stalePayload,
  payload_hash: `hash:${stalePayloadBody}`,
  requested_at: '2026-10-01T18:00:00.000Z',
})
outbox.push(staleOutbox)
const callsBeforeStale = gatewayCalls.length
const staleResult = invokeOutbox(superadmin)
assert.equal(staleResult.payload.invalidados, 1)
assert.equal(staleOutbox.getString('status'), 'invalidado')
assert.equal(gatewayCalls.length, callsBeforeStale)

const leasePayload = JSON.parse(JSON.stringify(outbox[1].get('payload_json')))
leasePayload.knowledge_ref = 'lease-recovery'
leasePayload.case_revision = 4
leasePayload.approval.approval_id = 'lease-recovery-approval'
leasePayload.approval.case_ref = 'lease-recovery'
leasePayload.approval.case_revision = 4
const leasePayloadBody = JSON.stringify(leasePayload)
const expiredLeaseOutbox = new MockRecord('com_nexo_curadoria_outbox', 'outbox-expired-lease', {
  caso_id: 'case-management',
  caso_revisao: 4,
  acao: leasePayload.action,
  idempotency_key: 'expired-lease-idempotency',
  status: 'processando',
  claim_token: 'abandoned-claim',
  claim_expires_at: '2020-01-01T00:00:00.000Z',
  tentativas: 0,
  tentativas_ciclo: 0,
  payload_json: leasePayload,
  payload_hash: `hash:${leasePayloadBody}`,
  requested_at: '2026-10-01T19:00:00.000Z',
})
outbox.push(expiredLeaseOutbox)
gatewayMode = 'success'
const recoveredExpiredLease = invokeOutbox(superadmin)
assert.equal(recoveredExpiredLease.payload.processados, 1)
assert.equal(expiredLeaseOutbox.getString('status'), 'processado')
assert.notEqual(expiredLeaseOutbox.getString('claim_token'), 'abandoned-claim')

const revisionPayload = JSON.parse(JSON.stringify(outbox[1].get('payload_json')))
revisionPayload.knowledge_ref = 'revision-race'
revisionPayload.case_revision = 4
revisionPayload.approval.approval_id = 'revision-race-approval'
revisionPayload.approval.case_ref = 'revision-race'
revisionPayload.approval.case_revision = 4
const revisionPayloadBody = JSON.stringify(revisionPayload)
const revisionRaceOutbox = new MockRecord('com_nexo_curadoria_outbox', 'outbox-revision-race', {
  caso_id: 'case-management',
  caso_revisao: 4,
  acao: revisionPayload.action,
  idempotency_key: 'revision-race-idempotency',
  status: 'pendente',
  tentativas: 0,
  tentativas_ciclo: 0,
  payload_json: revisionPayload,
  payload_hash: `hash:${revisionPayloadBody}`,
  requested_at: '2026-10-01T20:00:00.000Z',
})
outbox.push(revisionRaceOutbox)
gatewayMode = 'revision_during_http'
const revisionChangedDuringHttp = invokeOutbox(superadmin)
assert.equal(revisionChangedDuringHttp.payload.processados, 0)
assert.equal(revisionChangedDuringHttp.payload.invalidados, 1)
assert.equal(revisionRaceOutbox.getString('status'), 'invalidado')
assert.equal(revisionRaceOutbox.getString('last_error'), 'REVISAO_SUPERADA_APOS_HTTP')

const preHttpPayload = JSON.parse(JSON.stringify(outbox[1].get('payload_json')))
preHttpPayload.knowledge_ref = 'pre-http-race'
preHttpPayload.case_revision = 1
preHttpPayload.approval.approval_id = 'pre-http-race-approval'
preHttpPayload.approval.case_ref = 'pre-http-race'
preHttpPayload.approval.case_revision = 1
const preHttpPayloadBody = JSON.stringify(preHttpPayload)
const preHttpRaceOutbox = new MockRecord('com_nexo_curadoria_outbox', 'outbox-pre-http-race', {
  caso_id: 'case-management',
  caso_revisao: 1,
  acao: preHttpPayload.action,
  idempotency_key: 'pre-http-race-idempotency',
  status: 'pendente',
  claim_token: '',
  superseded_by: '',
  tentativas: 0,
  tentativas_ciclo: 0,
  payload_json: preHttpPayload,
  payload_hash: `hash:${preHttpPayloadBody}`,
  requested_at: '2026-10-01T21:00:00.000Z',
})
outbox.push(preHttpRaceOutbox)
const callsBeforePreHttpRace = gatewayCalls.length
gatewayMode = 'supersede_before_http'
const preHttpRace = invokeOutbox(superadmin)
assert.equal(preHttpRace.payload.processados, 0)
assert.equal(preHttpRaceOutbox.getString('status'), 'supersedido')
assert.equal(preHttpRaceOutbox.getString('superseded_by'), 'interleaving-before-http')
assert.equal(gatewayCalls.length, callsBeforePreHttpRace)

console.log('nexo-curadoria-casos-api runtime: PASS')
