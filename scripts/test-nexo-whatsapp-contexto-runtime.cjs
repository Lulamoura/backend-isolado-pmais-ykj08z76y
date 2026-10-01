const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '..')
const hookPath = path.join(root, 'pocketbase/hooks/com_propostas_operacao.js')
const source = fs.readFileSync(hookPath, 'utf8')
const routes = []

const app = {}
const context = {
  console,
  Date,
  JSON,
  Array,
  String,
  Number,
  Boolean,
  RegExp,
  Error,
  encodeURIComponent,
  Record: function Record() {},
  $app: app,
  $http: {
    send() {
      throw new Error('HTTP_NOT_EXPECTED')
    },
  },
  $secrets: {
    get() {
      return ''
    },
  },
  $os: {
    getenv() {
      return ''
    },
  },
  $security: {
    sha256(value) {
      return String(value || '')
    },
    hmacSign() {
      return ''
    },
  },
  $apis: {
    requireAuth() {
      return function requireAuth() {}
    },
  },
  routerAdd(method, routePath, handler) {
    routes.push({ method, path: routePath, handler })
  },
}
vm.runInNewContext(source, context, { filename: hookPath })

const route = routes.find(
  (item) =>
    item.method === 'GET' && item.path === '/backend/v1/nexo/negocios/{externalId}/contexto',
)
assert.ok(route, 'rota governada de contexto do Nexo deve existir')

class MockRecord {
  constructor(id, fields = {}) {
    this.id = id
    this.fields = { ...fields }
  }
  getString(name) {
    const value = this.fields[name]
    return value === null || value === undefined ? '' : String(value)
  }
  getBool(name) {
    return Boolean(this.fields[name])
  }
  getInt(name) {
    return Number(this.fields[name] || 0)
  }
  get(name) {
    return this.fields[name]
  }
}

const actor = new MockRecord('integration-user', {
  ativo_comercial: true,
  perfil_id: 'perfil-integracao',
  equipe_id: 'equipe-1',
})
const negocio = new MockRecord('negocio-1', {
  responsavel_id: actor.id,
  equipe_id: 'equipe-1',
  titulo: 'Negócio verificado no servidor',
  fase_crm: 'Negociação',
  descricao: 'Escopo confirmado no cadastro interno.',
})
const vinculoExterno = new MockRecord('vinculo-externo-1', { record_id: negocio.id })

app.findRecordById = (collection, id) => {
  if (collection === 'com_perfis' && id === 'perfil-integracao')
    return new MockRecord(id, { slug: 'integracao' })
  if (collection === 'com_perfis' && id === 'perfil-vendedor')
    return new MockRecord(id, { slug: 'vendedor' })
  if (collection === 'com_negocios' && id === negocio.id) return negocio
  throw new Error(`registro inesperado: ${collection}/${id}`)
}
app.findFirstRecordByFilter = (collection) => {
  if (collection === 'com_vinculos_externos') return vinculoExterno
  throw new Error(`consulta inesperada: ${collection}`)
}
app.findRecordsByFilter = () => []

const event = {
  auth: actor,
  request: {
    pathValue(name) {
      assert.equal(name, 'externalId')
      return '4792'
    },
  },
  json(status, body) {
    return { status, body }
  },
  badRequestError(message) {
    return { status: 400, message }
  },
  notFoundError(message) {
    return { status: 404, message }
  },
  forbiddenError(message) {
    return { status: 403, message }
  },
}

const response = route.handler(event)
assert.equal(
  response.status,
  403,
  'perfil integracao deve falhar fechado antes de consultar conteúdo WhatsApp',
)
assert.match(response.message, /perfil|autoriz|escopo|conteúdo|conteudo/i)

const helpRoute = routes.find(
  (item) => item.method === 'POST' && item.path === '/backend/v1/nexo/negocios/{externalId}/ajuda',
)
assert.ok(helpRoute, 'rota de geração assistida do Nexo deve existir')
const helpEvent = {
  ...event,
  requestInfo() {
    return {
      body: {
        acao: 'proximo_follow_up',
        contexto: { external_id: '4792', whatsapp_contexto: { status: 'disponivel' } },
      },
    }
  },
}
const helpResponse = helpRoute.handler(helpEvent)
assert.equal(
  helpResponse.status,
  403,
  'perfil integracao não pode submeter contexto comercial à geração do Nexo',
)
assert.match(helpResponse.message, /perfil|autoriz|escopo|conteúdo|conteudo/i)

const actorForaDoEscopo = new MockRecord('outro-vendedor', {
  ativo_comercial: true,
  perfil_id: 'perfil-vendedor',
  equipe_id: 'equipe-2',
})
const helpSemEscopo = helpRoute.handler({
  ...helpEvent,
  auth: actorForaDoEscopo,
})
assert.equal(
  helpSemEscopo.status,
  403,
  'geração do Nexo deve repetir no servidor o escopo do negócio',
)
assert.match(helpSemEscopo.message, /escopo|autoriz/i)

const actorPerfilAusente = new MockRecord(actor.id, {
  ativo_comercial: true,
  perfil_id: 'perfil-inexistente',
  equipe_id: 'equipe-1',
})
const contextoSemPerfil = route.handler({
  ...event,
  auth: actorPerfilAusente,
})
assert.equal(
  contextoSemPerfil.status,
  403,
  'consulta deve falhar fechada quando o perfil comercial não puder ser resolvido',
)
const ajudaSemPerfil = helpRoute.handler({
  ...helpEvent,
  auth: actorPerfilAusente,
})
assert.equal(
  ajudaSemPerfil.status,
  403,
  'geração deve falhar fechada quando o perfil comercial não puder ser resolvido',
)

const actorAdmin = new MockRecord('admin-user', {
  ativo_comercial: true,
  perfil_id: 'perfil-admin',
})
const vinculoDireto = new MockRecord('link-direto', {
  status: 'vinculado',
  negocio_id: negocio.id,
  negocio_ids: [],
  provider: 'uazapi',
  instance_name: 'operadora-a',
  owner: 'owner-a',
  chat_id: 'chat-a',
})
const vinculoMultiplo = new MockRecord('link-multiplo', {
  status: 'vinculado_multiplo',
  negocio_id: '',
  negocio_ids: [negocio.id, 'outro-negocio'],
  provider: 'uazapi',
  instance_name: 'operadora-b',
  owner: 'owner-b',
  chat_id: 'chat-b',
})
const mensagemAntiga = new MockRecord('mensagem-antiga', {
  direction: 'saida',
  message_type: 'text',
  body_text: 'Enviei a proposta para sua validação.',
  message_at: '2026-09-30T12:00:00Z',
  chat_id: 'chat-a',
  sender_id: 'nao-expor',
})
const mensagemRecente = new MockRecord('mensagem-recente', {
  direction: 'entrada',
  message_type: 'text',
  body_text: 'Vou validar com o RH e retorno até sexta-feira.',
  message_at: '2026-10-01T12:00:00Z',
  chat_id: 'chat-b',
  sender_id: 'nao-expor',
})
const filtrosMensagens = []
let incluirMensagens = true
context.$secrets.get = (name) => {
  if (name === 'AC_API_URL') return 'https://activecampaign.example.invalid'
  if (name === 'AC_API_KEY') return 'segredo-de-teste'
  return ''
}
context.$http.send = ({ url }) => {
  if (url.includes('/api/3/deals/4792')) return { statusCode: 200, json: { deal: { id: '4792' } } }
  if (url.includes('/api/3/dealCustomFieldMeta'))
    return { statusCode: 200, json: { dealCustomFieldMeta: [] } }
  if (url.includes('/api/3/dealCustomFieldData'))
    return { statusCode: 200, json: { dealCustomFieldData: [] } }
  if (url.includes('/api/3/notes')) return { statusCode: 200, json: { notes: [] } }
  throw new Error(`HTTP inesperado: ${url}`)
}
app.findRecordById = (collection, id) => {
  if (collection === 'com_perfis' && id === 'perfil-admin')
    return new MockRecord(id, { slug: 'superadministrador' })
  if (collection === 'com_negocios' && id === negocio.id) return negocio
  if (collection === 'users' && id === actor.id) return actor
  throw new Error(`registro inesperado: ${collection}/${id}`)
}
app.findFirstRecordByFilter = (collection) => {
  if (collection === 'com_vinculos_externos') return vinculoExterno
  throw new Error(`consulta inesperada: ${collection}`)
}
app.findFirstRecordByData = () => {
  throw new Error('sem proposta local')
}
app.findRecordsByFilter = (collection, filter, sort) => {
  if (collection === 'com_whatsapp_vinculos') {
    assert.equal(sort, '-last_message_at,-created,-id')
    return filter.includes('negocio_ids ~') ? [vinculoMultiplo] : [vinculoDireto]
  }
  if (collection === 'com_whatsapp_mensagens') {
    filtrosMensagens.push(filter)
    if (!incluirMensagens) return []
    return filter.includes("chat_id = 'chat-b'") ? [mensagemRecente] : [mensagemAntiga]
  }
  if (collection === 'com_proposta_versoes') return []
  return []
}

const contextoAutorizado = route.handler({ ...event, auth: actorAdmin })
assert.equal(contextoAutorizado.status, 200)
assert.equal(contextoAutorizado.body.whatsapp_contexto.status, 'disponivel')
assert.equal(contextoAutorizado.body.whatsapp_contexto.conversas_vinculadas, 2)
assert.equal(contextoAutorizado.body.whatsapp_contexto.mensagens_recentes_consideradas, 2)
assert.equal(
  contextoAutorizado.body.whatsapp_contexto.mensagens_recentes[0].texto,
  'Vou validar com o RH e retorno até sexta-feira.',
)
assert.ok(filtrosMensagens.every((filter) => filter.includes('is_group = false')))
const serializado = JSON.stringify(contextoAutorizado.body.whatsapp_contexto)
for (const technical of ['chat_id', 'sender_id', 'message_id', 'owner', 'instance_name'])
  assert.equal(serializado.includes(technical), false, `não deve expor ${technical}`)

let gatewayPayload = null
context.Record = class Record {
  constructor(collection) {
    this.collection = collection
    this.fields = {}
  }
  set(name, value) {
    this.fields[name] = value
  }
}
app.findCollectionByNameOrId = () => ({
  fields: {
    getByName() {
      return { required: false }
    },
  },
})
app.save = () => {}
context.$security.hs256 = () => 'assinatura-de-teste'
context.$secrets.get = (name) => {
  if (name === 'PMAIS_AGENT_GATEWAY_URL') return 'https://gateway.example.invalid'
  if (name === 'PMAIS_AGENT_GATEWAY_API_KEY') return 'api-key-de-teste'
  if (name === 'PMAIS_AGENT_GATEWAY_HMAC_SECRET') return 'hmac-de-teste'
  if (name === 'AC_API_URL') return 'https://crm.example.invalid'
  if (name === 'AC_API_KEY') return 'ac-key-de-teste'
  return ''
}
context.$http.send = (options) => {
  if (options.url === 'https://crm.example.invalid/api/3/deals/4792') {
    return {
      statusCode: 200,
      json: {
        deal: {
          id: '4792',
          title: 'Negócio confirmado no CRM',
          description: 'Descrição confirmada no CRM',
          value: '45600',
          stage: '8',
          nextdate: '2026-10-04',
        },
      },
    }
  }
  if (options.url.includes('/api/3/notes?')) {
    return {
      statusCode: 200,
      json: {
        notes: [{ id: 'nota-1', note: 'NOTA VERIFICADA NO SERVIDOR', cdate: '2026-10-01' }],
      },
    }
  }
  if (!options.url.includes('/v1/comercial/nexo/ajuda-negocio'))
    throw new Error(`HTTP inesperado: ${options.url}`)
  gatewayPayload = JSON.parse(options.body)
  return {
    statusCode: 200,
    json: {
      resposta_curta: 'Leitura breve: contexto verificado no servidor.',
      diagnostico: 'ok',
      risco_principal: '',
      recomendacao: 'revisar',
      perguntas_de_avanco: [],
      mensagem_whatsapp_sugerida: '',
      proximo_passo: 'revisar',
      dicas_para_melhorar_notas: [],
      resumo_conversa: 'Resumo factual devolvido pelo gateway',
      pendencias_compromissos: ['Compromisso devolvido pelo gateway'],
      prazos_proximas_acoes: ['Prazo devolvido pelo gateway'],
      objecoes_duvidas: ['Objeção devolvida pelo gateway'],
      sinais_risco: ['Risco devolvido pelo gateway'],
      divergencias_crm: ['Divergência devolvida pelo gateway'],
      proximo_passo_recomendado: 'Próximo passo sugerido pelo gateway',
      rascunho_follow_up: 'Rascunho sugerido pelo gateway',
    },
  }
}
const ajudaComContextoAdulterado = helpRoute.handler({
  ...helpEvent,
  auth: actorAdmin,
  requestInfo() {
    return {
      body: {
        acao: 'proximo_follow_up',
        contexto: {
          external_id: '4792',
          negocio: { titulo: 'NEGOCIO ADULTERADO NO NAVEGADOR' },
          empresa: { nome: 'EMPRESA ADULTERADA NO NAVEGADOR' },
          notas_followups: [{ texto: 'NOTA ADULTERADA NO NAVEGADOR' }],
          whatsapp_contexto: {
            status: 'disponivel',
            mensagens_recentes: [
              {
                direcao: 'cliente',
                momento: '2026-10-01T13:00:00Z',
                texto: 'CONTEUDO ADULTERADO NO NAVEGADOR',
                tipo: 'texto',
              },
            ],
          },
        },
      },
    }
  },
})
assert.equal(ajudaComContextoAdulterado.status, 200)
assert.ok(gatewayPayload, 'rota deve chamar o gateway com contexto governado')
assert.equal(
  gatewayPayload.contexto.whatsapp_contexto.negocio_external_id,
  '4792',
  'o contexto WhatsApp deve carregar o identificador humano do próprio negócio',
)
const mensagensGateway = gatewayPayload.contexto.whatsapp_contexto.mensagens_recentes
assert.equal(
  mensagensGateway.some((item) => item.texto.includes('ADULTERADO')),
  false,
)
assert.equal(
  mensagensGateway[0].texto,
  'Vou validar com o RH e retorno até sexta-feira.',
  'geração deve recarregar o conteúdo no servidor em vez de confiar no navegador',
)
const contextoGatewaySerializado = JSON.stringify(gatewayPayload.contexto)
assert.equal(contextoGatewaySerializado.includes('ADULTERAD'), false)
assert.equal(gatewayPayload.contexto.negocio.titulo, 'Negócio confirmado no CRM')
assert.equal(gatewayPayload.contexto.notas_followups[0].texto, 'NOTA VERIFICADA NO SERVIDOR')
assert.equal(
  ajudaComContextoAdulterado.body.analise_whatsapp.resumo_conversa,
  'Resumo factual devolvido pelo gateway',
)

incluirMensagens = false
const ajudaSemMensagensVerificaveis = helpRoute.handler({ ...helpEvent, auth: actorAdmin })
assert.equal(ajudaSemMensagensVerificaveis.status, 200)
assert.equal(ajudaSemMensagensVerificaveis.body.analise_whatsapp.status_contexto, 'disponivel')
assert.equal(ajudaSemMensagensVerificaveis.body.analise_whatsapp.resumo_conversa, '')
assert.equal(ajudaSemMensagensVerificaveis.body.analise_whatsapp.pendencias_compromissos.length, 0)
assert.equal(ajudaSemMensagensVerificaveis.body.analise_whatsapp.prazos_proximas_acoes.length, 0)
assert.equal(ajudaSemMensagensVerificaveis.body.analise_whatsapp.objecoes_duvidas.length, 0)
assert.equal(ajudaSemMensagensVerificaveis.body.analise_whatsapp.sinais_risco.length, 0)
assert.equal(ajudaSemMensagensVerificaveis.body.analise_whatsapp.divergencias_crm.length, 0)
assert.equal(
  ajudaSemMensagensVerificaveis.body.analise_whatsapp.proximo_passo_recomendado,
  'Próximo passo sugerido pelo gateway',
)
assert.equal(
  ajudaSemMensagensVerificaveis.body.analise_whatsapp.rascunho_follow_up,
  'Rascunho sugerido pelo gateway',
)

console.log('nexo-whatsapp-contexto runtime: PASS')
