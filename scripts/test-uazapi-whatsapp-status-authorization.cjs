const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const raiz = path.resolve(__dirname, '..')
const hookPath = path.join(raiz, 'pocketbase/hooks/com_whatsapp_uazapi_webhook.js')
const source = fs.readFileSync(hookPath, 'utf8')
const routes = []
const context = {
  console,
  Date,
  JSON,
  Array,
  String,
  Number,
  Error,
  Record: function Record() {},
  Collection: function Collection() {},
  TextField: function TextField() {},
  JSONField: function JSONField() {},
  DateField: function DateField() {},
  BoolField: function BoolField() {},
  AutodateField: function AutodateField() {},
  $security: {},
  $apis: { bodyLimit: () => function bodyLimit() {} },
  $secrets: { get: () => 'configurado' },
  $app: {},
  routerAdd(method, routePath, handler) {
    routes.push({ method, path: routePath, handler })
  },
}
vm.runInNewContext(source, context, { filename: hookPath })
const route = routes.find(
  (item) => item.method === 'GET' && item.path === '/backend/v1/integracao/whatsapp/uazapi/status',
)
if (!route) throw new Error('FAIL rota de status não encontrada')

class MockRecord {
  constructor(id, fields) {
    this.id = id
    this.fields = fields
  }
  get(name) {
    return this.fields[name]
  }
  getString(name) {
    const value = this.fields[name]
    return value === null || value === undefined ? '' : String(value)
  }
  getBool(name) {
    return Boolean(this.fields[name])
  }
  getFloat(name) {
    return Number(this.fields[name] || 0)
  }
  getDateTime(name) {
    return this.getString(name)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL ${message}`)
  console.log(`PASS ${message}`)
}

function executar(perfil, equipeCandidato = 'equipe-1') {
  const vinculo = new MockRecord('vinculo-1', {
    provider: 'uazapi',
    instance_name: 'Operadora Comercial',
    owner: '558100000000',
    chat_id: '558199999999@s.whatsapp.net',
    telefone: '558199999999',
    contato_id: 'contato-1',
    empresa_id: 'empresa-1',
    negocio_id: '',
    negocio_ids: [],
    status: 'ambiguidade_negocio_aberto',
    last_message_at: '2026-09-30 20:00:00.000Z',
  })
  const mensagem = new MockRecord('mensagem-1', {
    provider: 'uazapi',
    instance_name: 'Operadora Comercial',
    owner: '558100000000',
    chat_id: '558199999999@s.whatsapp.net',
    sender_name: 'Contato Protegido',
    texto: 'Conteúdo comercial protegido',
    direcao: 'recebida',
    message_type: 'Conversation',
    status: 'capturada',
    is_group: false,
    received_at: '2026-09-30 20:00:00.000Z',
    message_at: '2026-09-30 20:00:00.000Z',
  })
  const negocio = new MockRecord('negocio-1', {
    contato_principal_id: 'contato-1',
    empresa_id: 'empresa-1',
    equipe_id: equipeCandidato,
    responsavel_id: 'outro-usuario',
    resultado: '',
    inativo: false,
    necessidade: 'Serviço protegido',
    etapa: 'negociacao',
    valor: 100,
    updated: '2026-09-30 19:00:00.000Z',
  })
  const evento = new MockRecord('evento-1', {
    instance_name: 'Outra equipe',
    owner: '558100000000',
    event_type: 'messages',
    status: 'recebido',
    received_at: '2026-09-30 20:00:00.000Z',
  })
  const midia = new MockRecord('midia-1', {
    media_type: 'AudioMessage',
    download_status: 'pendente',
    transcricao_status: 'pendente_transcricao',
    received_at: '2026-09-30 20:00:00.000Z',
  })
  const dados = {
    com_whatsapp_eventos: [evento],
    com_whatsapp_mensagens: [mensagem],
    com_whatsapp_midias: [midia],
    com_whatsapp_vinculos: [vinculo],
    com_negocios: [negocio],
    com_propostas: [],
  }
  context.$app = {
    findRecordById(collection, id) {
      if (collection === 'com_perfis')
        return new MockRecord('perfil-1', { slug: perfil, ativo: true })
      if (collection === 'com_contatos') return new MockRecord(id, { nome: 'Contato Protegido' })
      if (collection === 'com_empresas') return new MockRecord(id, { nome: 'Empresa Protegida' })
      if (collection === 'com_negocios') return negocio
      throw new Error('registro não encontrado')
    },
    findRecordsByFilter(collection, _filter, _sort, limit, offset) {
      const records = dados[collection] || []
      return records.slice(offset || 0, (offset || 0) + (limit || records.length))
    },
  }
  const actor = new MockRecord('usuario-1', {
    ativo_comercial: true,
    perfil_id: 'perfil-1',
    equipe_id: 'equipe-1',
  })
  const e = {
    auth: actor,
    json: (statusCode, body) => ({ statusCode, body }),
    unauthorizedError: (message) => ({ statusCode: 401, body: { error: message } }),
    forbiddenError: (message) => ({ statusCode: 403, body: { error: message } }),
  }
  return route.handler(e)
}

let resposta = executar('integracao')
assert(resposta.statusCode === 200, 'perfil técnico recebe apenas estado de saúde autorizado')
assert(resposta.body.visao_restrita === true, 'marca a resposta técnica como restrita')
assert(
  !('ultima_mensagem' in resposta.body),
  'perfil técnico não recebe metadados da última mensagem',
)
assert(
  !('qualidade_base' in resposta.body),
  'perfil técnico não recebe contexto comercial agregado',
)
assert(
  resposta.body.ambiguidades_negocios_abertos.length === 0,
  'perfil técnico não recebe ambiguidades',
)
assert(
  !JSON.stringify(resposta.body).includes('Conteúdo comercial protegido'),
  'perfil técnico não recebe corpo de mensagem',
)

resposta = executar('gestor-comercial', 'equipe-1')
assert(resposta.statusCode === 200, 'gestor ativo recebe a fila do próprio escopo')
assert(
  resposta.body.ambiguidades_negocios_abertos.length === 1,
  'gestor recebe ambiguidade integralmente autorizada',
)
assert(
  resposta.body.qualidade_base === null,
  'gestor não recebe qualidade global de outras equipes',
)
assert(resposta.body.ultima_mensagem === null, 'gestor não recebe última mensagem global')
assert(Object.keys(resposta.body.counts).length === 0, 'gestor não recebe contadores globais')

resposta = executar('gestor-comercial', 'equipe-2')
assert(resposta.statusCode === 200, 'gestor fora do escopo recebe resposta segura')
assert(
  resposta.body.ambiguidades_negocios_abertos.length === 0,
  'gestor não recebe conversa de outra equipe',
)
assert(
  !JSON.stringify(resposta.body).includes('Conteúdo comercial protegido'),
  'gestor não recebe mensagem fora do escopo',
)
