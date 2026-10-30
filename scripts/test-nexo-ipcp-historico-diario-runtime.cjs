const fs = require('node:fs')
const vm = require('node:vm')
const assert = require('node:assert/strict')

const hookPath = 'pocketbase/hooks/com_nexo_central_operacional.js'
const source = fs.readFileSync(hookPath, 'utf8')

const routes = new Map()
let writes = 0

class MockRecord {
  constructor(id, data) {
    this.id = id
    this.data = { ...data }
  }
  get(field) {
    return this.data[field]
  }
  getString(field) {
    const value = this.data[field]
    return value == null ? '' : String(value)
  }
  getBool(field) {
    return Boolean(this.data[field])
  }
}

const users = {
  g6pxypm3844lq68: 'Raquel Trindade Bezerra da Silva',
  '2l6xnywtiwm53xq': 'Cristiane Maria da Silva',
  d1spnjkg3g7l6fd: 'Viviane Marculino da Silva',
  pmdghnoqc5x3rnn: 'Shirleide Andrade do Nascimento',
}

function snapshot(id, overrides = {}) {
  const blocos = {
    resultado_comercial: 20,
    valor_estrategico: 10,
    disciplina_carteira: 15,
    qualidade_followup: 12,
    registros_aprendizado: 7.3,
  }
  return new MockRecord(id, {
    data_referencia: '2026-10-30',
    escopo: 'equipe',
    responsavel_id: 'g6pxypm3844lq68',
    responsavel_nome: users.g6pxypm3844lq68,
    formula_version: 'ipcp_v0_5',
    ipcp_total: 64.3,
    modo: 'processamento_diario',
    status: 'producao_assistida',
    origem: 'ipcp_job_diario',
    updated: '2026-10-30 22:05:00.000Z',
    created: '2026-10-30 22:00:00.000Z',
    payload: { pacote_completo: true, ipcp: { total: 64.3, blocos } },
    ...overrides,
  })
}

const snapshotsByUser = {
  g6pxypm3844lq68: [
    snapshot('simulado-mais-novo', {
      modo: 'simulado',
      status: 'homologacao',
      updated: '2026-10-30 23:00:00.000Z',
      ipcp_total: 99,
      payload: { pacote_completo: true, ipcp: { total: 99, blocos: {} } },
    }),
    ...Array.from({ length: 205 }, (_, index) =>
      snapshot(`incompleto-${index}`, {
        updated: `2026-10-30 22:${String(59 - (index % 59)).padStart(2, '0')}:30.000Z`,
        payload: {
          pacote_completo: false,
          ipcp: {
            total: null,
            blocos: {
              resultado_comercial: '',
              valor_estrategico: 10,
              disciplina_carteira: 15,
              qualidade_followup: 12,
              registros_aprendizado: 7.3,
            },
          },
        },
      }),
    ),
    snapshot('raquel-operacional'),
  ],
  '2l6xnywtiwm53xq': [
    snapshot('cristiane-operacional', {
      responsavel_id: '2l6xnywtiwm53xq',
      responsavel_nome: users['2l6xnywtiwm53xq'],
      ipcp_total: 61.6,
      payload: {
        pacote_completo: true,
        ipcp: {
          total: 61.6,
          blocos: {
            resultado_comercial: 19,
            valor_estrategico: 9,
            disciplina_carteira: 14,
            qualidade_followup: 12,
            registros_aprendizado: 7.6,
          },
        },
      },
    }),
  ],
  d1spnjkg3g7l6fd: [
    snapshot('viviane-total-nulo', {
      responsavel_id: 'd1spnjkg3g7l6fd',
      responsavel_nome: users.d1spnjkg3g7l6fd,
      payload: {
        pacote_completo: true,
        ipcp: {
          total: null,
          blocos: {
            resultado_comercial: 18,
            valor_estrategico: 9,
            disciplina_carteira: 14,
            qualidade_followup: 12,
            registros_aprendizado: 7.8,
          },
        },
      },
    }),
    snapshot('viviane-total-vazio', {
      responsavel_id: 'd1spnjkg3g7l6fd',
      responsavel_nome: users.d1spnjkg3g7l6fd,
      payload: {
        pacote_completo: true,
        ipcp: {
          total: '',
          blocos: {
            resultado_comercial: 18,
            valor_estrategico: 9,
            disciplina_carteira: 14,
            qualidade_followup: 12,
            registros_aprendizado: 7.8,
          },
        },
      },
    }),
    snapshot('viviane-bloco-nulo', {
      responsavel_id: 'd1spnjkg3g7l6fd',
      responsavel_nome: users.d1spnjkg3g7l6fd,
      payload: {
        pacote_completo: true,
        ipcp: {
          total: 60.8,
          blocos: {
            resultado_comercial: 18,
            valor_estrategico: null,
            disciplina_carteira: 14,
            qualidade_followup: 12,
            registros_aprendizado: 7.8,
          },
        },
      },
    }),
    snapshot('viviane-bloco-vazio', {
      responsavel_id: 'd1spnjkg3g7l6fd',
      responsavel_nome: users.d1spnjkg3g7l6fd,
      payload: {
        pacote_completo: true,
        ipcp: {
          total: 60.8,
          blocos: {
            resultado_comercial: 18,
            valor_estrategico: '',
            disciplina_carteira: 14,
            qualidade_followup: 12,
            registros_aprendizado: 7.8,
          },
        },
      },
    }),
    snapshot('viviane-total-array-malformado', {
      responsavel_id: 'd1spnjkg3g7l6fd',
      responsavel_nome: users.d1spnjkg3g7l6fd,
      payload: {
        pacote_completo: true,
        ipcp: {
          total: [],
          blocos: {
            resultado_comercial: 18,
            valor_estrategico: 9,
            disciplina_carteira: 14,
            qualidade_followup: 12,
            registros_aprendizado: 7.8,
          },
        },
      },
    }),
  ],
  pmdghnoqc5x3rnn: [],
}

const context = vm.createContext({
  console,
  Date,
  JSON,
  Math,
  Number,
  Object,
  String,
  Boolean,
  Array,
  RegExp,
  isFinite,
  encodeURIComponent,
  routerAdd(method, path, handler) {
    routes.set(`${method} ${path}`, handler)
  },
  $apis: { requireAuth: () => () => {} },
  $secrets: {
    get: (name) => {
      if (name === 'PMAIS_NEXO_SERVICE_SECRET') return 'segredo-teste'
      if (name === 'AC_WEBHOOK_SECRET') return 'segredo-webhook-compartilhado'
      return ''
    },
  },
  $app: {
    findRecordById(collection, id) {
      if (collection !== 'users' || !users[id]) throw new Error('registro inexistente')
      return new MockRecord(id, { name: users[id] })
    },
    findRecordsByFilter(collection, filter, _sort, limit, offset) {
      assert.equal(collection, 'com_ipcp_snapshots')
      const match = filter.match(/responsavel_id = '([^']+)'/)
      if (context.sourceFailure) throw new Error('fonte indisponível')
      let rows = match ? snapshotsByUser[match[1]] || [] : []
      if (filter.includes("modo = 'processamento_diario'")) {
        rows = rows.filter((record) => record.getString('modo') === 'processamento_diario')
      }
      if (filter.includes("status = 'producao_assistida'")) {
        rows = rows.filter((record) => record.getString('status') === 'producao_assistida')
      }
      return rows.slice(offset || 0, (offset || 0) + limit)
    },
    save() {
      writes += 1
      throw new Error('consulta histórica tentou gravar')
    },
    delete() {
      writes += 1
      throw new Error('consulta histórica tentou excluir')
    },
  },
})

vm.runInContext(source, context, { filename: hookPath })
const handler = routes.get('POST /backend/v1/nexo/consulta-app')
assert.ok(handler, 'rota governada consulta-app deve estar registrada')

function call(body, secret = 'segredo-teste') {
  return handler({
    request: {
      header: { get: (name) => (name === 'x-pmais-nexo-service-secret' ? secret : '') },
    },
    requestInfo: () => ({ body }),
    json: (status, data) => ({ status, data }),
    forbiddenError: (message) => ({ status: 403, data: { error: message } }),
  })
}

let response = call({
  tipo_consulta: 'ipcp_historico_diario',
  inicio: '2026-10-29',
  fim: '2026-10-30',
  responsavel_ids: Object.keys(users),
  escopo: 'equipe',
})
assert.equal(response.status, 200)
assert.equal(response.data.contrato_ipcp, 'nexo_ipcp_historico_diario_v1')
assert.equal(response.data.somente_leitura, true)
assert.equal(response.data.read_only, true)
assert.equal(response.data.sem_mutacao, true)
assert.equal(response.data.no_mutation, true)
assert.deepEqual(JSON.parse(JSON.stringify(response.data.periodo_aplicado)), {
  inicio: '2026-10-29',
  fim: '2026-10-30',
  timezone: 'America/Recife',
})
assert.equal(response.data.total_pontos, response.data.pontos.length)
assert.equal(response.data.total_pontos, 2)
assert.equal(
  response.data.pontos.some((item) => item.responsavel_id === 'd1spnjkg3g7l6fd'),
  false,
  'total/blocos nulos, vazios ou malformados não podem virar pontos históricos',
)
assert.equal(response.data.pontos[0].data_referencia, '2026-10-30')
assert.equal(response.data.pontos[0].responsavel_nome, users.g6pxypm3844lq68)
assert.equal(
  response.data.pontos[0].ipcp_total,
  64.3,
  'snapshot simulado mais novo não pode substituir o operacional',
)
assert.deepEqual(Object.keys(response.data.pontos[0].blocos).sort(), [
  'disciplina_carteira',
  'qualidade_followup',
  'registros_aprendizado',
  'resultado_comercial',
  'valor_estrategico',
])
assert.equal(response.data.datas_sem_snapshot.length, 6)
assert.equal(
  response.data.datas_sem_snapshot.some(
    (item) => item.data_referencia === '2026-10-29' && item.responsavel_id === 'g6pxypm3844lq68',
  ),
  true,
)
assert.equal(response.data.guardrails.sem_crm_write, true)
assert.equal(response.data.guardrails.sem_app_write, true)
assert.equal(response.data.guardrails.sem_envio, true)
assert.equal(writes, 0)

response = call(
  {
    tipo_consulta: 'ipcp_historico_diario',
    inicio: '2026-10-01',
    fim: '2026-10-30',
    responsavel_ids: ['g6pxypm3844lq68'],
  },
  'segredo-webhook-compartilhado',
)
assert.equal(response.status, 403, 'histórico nominal deve exigir segredo dedicado do Nexo')

response = call({
  tipo_consulta: 'ipcp_historico_diario',
  inicio: '2026-10-01',
  fim: '2026-10-01',
  responsavel_ids: ['g6pxypm3844lq68'],
})
assert.equal(response.status, 200)
assert.equal(
  response.data.total_pontos,
  0,
  'dia ausente nunca pode cair para o snapshot mais recente',
)
assert.equal(response.data.datas_sem_snapshot.length, 1)
assert.equal(response.data.datas_sem_snapshot[0].data_referencia, '2026-10-01')

response = call({
  tipo_consulta: 'ipcp_historico_diario',
  inicio: '2026-10-01T00:00:00Z',
  fim: '2026-10-30',
  responsavel_ids: ['g6pxypm3844lq68'],
})
assert.equal(response.status, 400, 'datas com timestamp não podem ser aceitas como data civil')

response = call({
  tipo_consulta: 'ipcp_historico_diario',
  inicio: '2026-10-01',
  fim: '2026-10-30',
  responsavel_ids: ['usuario-nao-autorizado'],
})
assert.equal(response.status, 403)
assert.equal(response.data.error, 'IPCP_HISTORICO_RESPONSAVEL_NAO_AUTORIZADO')
assert.equal(writes, 0)

context.sourceFailure = true
response = call({
  tipo_consulta: 'ipcp_historico_diario',
  inicio: '2026-10-01',
  fim: '2026-10-30',
  responsavel_ids: ['g6pxypm3844lq68'],
})
assert.equal(response.status, 503)
assert.equal(response.data.error, 'IPCP_HISTORICO_FONTE_INDISPONIVEL')
assert.equal(writes, 0)

console.log('nexo-ipcp-historico-diario runtime: PASS')
