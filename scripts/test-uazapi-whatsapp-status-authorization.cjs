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

function executar(
  perfil,
  equipeCandidato = 'equipe-1',
  semEmpresa = false,
  cenarioQualidade = false,
) {
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
    responsavel_id: 'responsavel-1',
    equipe_id: equipeCandidato,
    oe_numero: '',
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
    com_vinculos_externos: [new MockRecord('vinculo-externo-1', { external_id: '4901' })],
    com_propostas: [],
  }
  if (cenarioQualidade) {
    const criarMensagem = (id, chatId, momento) =>
      new MockRecord(id, {
        provider: 'uazapi',
        instance_name: 'Operadora Comercial',
        owner: '558100000000',
        chat_id: chatId,
        sender_name: 'Contato Protegido',
        texto: 'Conteúdo comercial protegido',
        direcao: 'recebida',
        message_type: 'Conversation',
        status: 'capturada',
        is_group: false,
        received_at: momento,
        message_at: momento,
      })
    const criarVinculo = (id, chatId, status, negocioIds) =>
      new MockRecord(id, {
        provider: 'uazapi',
        instance_name: 'Operadora Comercial',
        owner: '558100000000',
        chat_id: chatId,
        telefone: chatId.split('@')[0],
        contato_id: status === 'sem_correspondencia' ? '' : 'contato-1',
        empresa_id: status === 'sem_correspondencia' ? '' : 'empresa-1',
        negocio_id: negocioIds[0] || '',
        negocio_ids: negocioIds,
        status,
        last_message_at: '2026-09-30 20:00:00.000Z',
      })

    dados.com_whatsapp_mensagens = [
      criarMensagem(
        'mensagem-vinculada-1',
        '558199999991@s.whatsapp.net',
        '2026-09-30 20:06:00.000Z',
      ),
      criarMensagem(
        'mensagem-vinculada-2',
        '558199999991@s.whatsapp.net',
        '2026-09-30 20:05:00.000Z',
      ),
      criarMensagem(
        'mensagem-ambigua-1',
        '558199999992@s.whatsapp.net',
        '2026-09-30 20:04:00.000Z',
      ),
      criarMensagem(
        'mensagem-ambigua-2',
        '558199999992@s.whatsapp.net',
        '2026-09-30 20:03:00.000Z',
      ),
      criarMensagem(
        'mensagem-ambigua-3',
        '558199999992@s.whatsapp.net',
        '2026-09-30 20:02:00.000Z',
      ),
      criarMensagem(
        'mensagem-pendente-1',
        '558199999993@s.whatsapp.net',
        '2026-09-30 20:01:00.000Z',
      ),
    ]
    dados.com_whatsapp_vinculos = [
      criarVinculo('vinculo-vinculado', '558199999991@s.whatsapp.net', 'vinculado_automatico', [
        'negocio-1',
      ]),
      criarVinculo(
        'vinculo-ambiguo',
        '558199999992@s.whatsapp.net',
        'ambiguidade_negocio_aberto',
        [],
      ),
      criarVinculo('vinculo-pendente', '558199999993@s.whatsapp.net', 'sem_correspondencia', []),
    ]
  }
  const colecoesSensiveis = Object.fromEntries(
    [
      'com_whatsapp_eventos',
      'com_whatsapp_mensagens',
      'com_whatsapp_midias',
      'com_ledger_comercial',
      'com_whatsapp_vinculos',
    ].map((name) => [
      name,
      { name, listRule: "@request.auth.id != ''", viewRule: "@request.auth.id != ''" },
    ]),
  )
  context.$app = {
    findCollectionByNameOrId(name) {
      const collection = colecoesSensiveis[name]
      if (!collection) throw new Error('coleção não encontrada')
      return collection
    },
    save(collection) {
      colecoesSensiveis[collection.name] = collection
    },
    findRecordById(collection, id) {
      if (collection === 'com_perfis')
        return new MockRecord('perfil-1', { slug: perfil, ativo: true })
      if (collection === 'com_contatos') return new MockRecord(id, { nome: 'Contato Protegido' })
      if (collection === 'com_empresas') {
        if (semEmpresa) throw new Error('empresa indisponível')
        return new MockRecord(id, { nome: 'Empresa Protegida' })
      }
      if (collection === 'users') return new MockRecord(id, { name: 'Cristiane PMais' })
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
    internalServerError: (message) => ({ statusCode: 500, body: { error: message } }),
  }
  const resposta = route.handler(e)
  resposta.colecoesSensiveis = colecoesSensiveis
  return resposta
}

let resposta = executar('integracao')
assert(resposta.statusCode === 200, 'perfil técnico recebe apenas estado de saúde autorizado')
assert(
  Object.values(resposta.colecoesSensiveis).every(
    (collection) => collection.listRule === null && collection.viewRule === null,
  ),
  'consulta autenticada de status fecha leitura direta das cinco coleções sensíveis',
)
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
const candidato = resposta.body.ambiguidades_negocios_abertos[0].negocios_candidatos[0]
assert(
  resposta.body.ambiguidades_negocios_abertos[0].contato === 'Contato Protegido',
  'ambiguidade preserva o contato humano',
)
assert(
  resposta.body.ambiguidades_negocios_abertos[0].empresa === 'Empresa Protegida',
  'ambiguidade preserva a empresa cliente',
)
assert(candidato.numero_comercial === '4901', 'candidato informa o número humano do negócio')
assert(candidato.cliente === 'Empresa Protegida', 'candidato informa o cliente')
assert(candidato.valor === 100, 'candidato informa o valor')
assert(candidato.responsavel === 'Cristiane PMais', 'candidato informa o responsável')
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

resposta = executar('gestor-comercial', 'equipe-1', true)
assert(
  resposta.body.ambiguidades_negocios_abertos[0].negocios_candidatos[0].cliente ===
    'Contato Protegido',
  'candidato usa o contato como cliente quando a empresa não está disponível',
)

resposta = executar('superadministrador', 'equipe-1', false, true)
const qualidadeOperador = resposta.body.qualidade_base.por_operador[0]
assert(qualidadeOperador.total_mensagens === 6, 'agregador preserva o volume total de mensagens')
assert(qualidadeOperador.total_conversas === 3, 'agregador conta conversas distintas por operador')
assert(
  resposta.body.qualidade_base.conversas_vinculadas_negocio === 1,
  'agregador expõe o total global de conversas vinculadas sem confundir com mensagens',
)
assert(
  qualidadeOperador.vinculadas_negocio === 2 &&
    qualidadeOperador.ambiguas === 3 &&
    qualidadeOperador.pendentes_ou_sem_vinculo === 1,
  'agregador preserva os contadores legados por mensagem',
)
assert(
  qualidadeOperador.conversas_vinculadas_negocio === 1 &&
    qualidadeOperador.conversas_ambiguas === 1 &&
    qualidadeOperador.conversas_pendentes_ou_sem_vinculo === 1,
  'agregador classifica cada conversa uma única vez por situação',
)
assert(
  qualidadeOperador.conversas_vinculadas_negocio +
    qualidadeOperador.conversas_ambiguas +
    qualidadeOperador.conversas_pendentes_ou_sem_vinculo ===
    qualidadeOperador.total_conversas,
  'situações somam exatamente o total de conversas distintas',
)
