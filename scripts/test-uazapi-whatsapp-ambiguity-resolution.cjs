const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const raiz = path.resolve(__dirname, '..')
const hookPath = path.join(raiz, 'pocketbase/hooks/com_whatsapp_uazapi_webhook.js')
const source = fs.readFileSync(hookPath, 'utf8')
const schema = JSON.parse(
  fs.readFileSync(path.join(raiz, 'src/lib/pocketbase/schema.json'), 'utf8'),
)
const lockdownMigration = fs.readFileSync(
  path.join(raiz, 'pocketbase/migrations/202609302359_whatsapp_private_collections.js'),
  'utf8',
)
let aplicarLockdown = null
vm.runInNewContext(lockdownMigration, {
  migrate(up) {
    aplicarLockdown = up
  },
})
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
  DateField: function DateField() {},
  BoolField: function BoolField() {},
  AutodateField: function AutodateField() {},
  $security: {},
  $apis: { bodyLimit: () => function bodyLimit() {} },
  $app: {},
  routerAdd(method, routePath, handler) {
    routes.push({ method, path: routePath, handler })
  },
}
vm.runInNewContext(source, context, { filename: hookPath })

const route = routes.find(
  (item) =>
    item.method === 'POST' &&
    item.path === '/backend/v1/integracao/whatsapp/uazapi/ambiguidades/{id}/resolver',
)
if (!route) throw new Error('FAIL endpoint comportamental da fila de ambiguidades não encontrado')

class MockRecord {
  constructor(id, fields) {
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
  getFloat(name) {
    return Number(this.fields[name] || 0)
  }
  set(name, value) {
    this.fields[name] = value
  }
}

const candidatoA = new MockRecord('negocio-a', {
  empresa_id: 'empresa-1',
  contato_principal_id: 'contato-1',
  equipe_id: 'equipe-1',
  responsavel_id: 'outro-usuario',
  resultado: '',
  inativo: false,
})
const candidatoB = new MockRecord('negocio-b', {
  empresa_id: 'empresa-1',
  contato_principal_id: 'contato-1',
  equipe_id: 'equipe-1',
  responsavel_id: 'outro-usuario',
  resultado: '',
  inativo: false,
})
const candidatoOutraEquipe = new MockRecord('negocio-outra-equipe', {
  empresa_id: 'empresa-1',
  contato_principal_id: 'contato-1',
  equipe_id: 'equipe-2',
  responsavel_id: 'outro-usuario',
  resultado: '',
  inativo: false,
})

function executar({
  negocioIds,
  status = 'ambiguidade_negocio_aberto',
  ativo = true,
  perfil = 'gestor-comercial',
  perfilAtivo = true,
  candidatos = [candidatoA, candidatoB],
}) {
  const vinculo = new MockRecord('vinculo-1', {
    status,
    contato_id: 'contato-1',
    empresa_id: 'empresa-1',
    negocio_id: '',
    negocio_ids: [],
    origem_decisao: 'sistema_multiplos_negocios_abertos_piloto_nexo_telegram',
    observacao: 'estado inicial',
    vinculado_em: '',
  })
  const salvos = []
  const tx = {
    findRecordById(collection, id) {
      if (collection === 'com_whatsapp_vinculos' && id === 'vinculo-1') return vinculo
      throw new Error('registro não encontrado')
    },
    findRecordsByFilter(collection, _filter, _sort, limit, offset) {
      if (collection === 'com_negocios')
        return candidatos.slice(offset || 0, (offset || 0) + (limit || candidatos.length))
      return []
    },
    save(record) {
      salvos.push(record)
    },
  }
  context.$app = {
    findRecordById(collection) {
      if (collection === 'com_perfis')
        return new MockRecord('perfil-1', { slug: perfil, ativo: perfilAtivo })
      throw new Error('registro não encontrado')
    },
    runInTransaction(callback) {
      return callback(tx)
    },
  }
  const actor = new MockRecord('usuario-1', {
    ativo_comercial: ativo,
    perfil_id: 'perfil-1',
    equipe_id: 'equipe-1',
  })
  const e = {
    auth: actor,
    request: { pathValue: () => 'vinculo-1' },
    requestInfo: () => ({ body: { negocio_ids: negocioIds } }),
    json: (statusCode, body) => ({ statusCode, body }),
    unauthorizedError: (message) => ({ statusCode: 401, body: { error: message } }),
    forbiddenError: (message) => ({ statusCode: 403, body: { error: message } }),
  }
  const resposta = route.handler(e)
  return { resposta, vinculo, salvos }
}

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL ${message}`)
  console.log(`PASS ${message}`)
}

let caso = executar({ negocioIds: ['negocio-a', 'negocio-b'] })
assert(caso.resposta.statusCode === 200, 'aceita seleção múltipla de candidatos abertos')
assert(caso.salvos.length === 1, 'grava a decisão uma única vez')
assert(caso.vinculo.fields.status === 'vinculado_multiplo', 'marca vínculo múltiplo')
assert(caso.vinculo.fields.negocio_id === '', 'não cria negócio principal artificial')
assert(
  JSON.stringify(caso.vinculo.fields.negocio_ids) === JSON.stringify(['negocio-a', 'negocio-b']),
  'preserva todos os negócios escolhidos',
)
assert(
  caso.vinculo.fields.origem_decisao === 'decisao_humana_fila_ambiguidades',
  'registra origem humana da decisão',
)
assert(caso.vinculo.fields.vinculado_em instanceof Date, 'registra o momento da decisão')

caso = executar({ negocioIds: ['negocio-b'] })
assert(caso.resposta.statusCode === 200, 'aceita seleção humana de um negócio')
assert(caso.vinculo.fields.status === 'vinculado_manual', 'distingue vínculo manual individual')
assert(
  caso.vinculo.fields.negocio_id === 'negocio-b',
  'mantém compatibilidade no vínculo individual',
)

caso = executar({ negocioIds: ['negocio-a'], candidatos: [candidatoA] })
assert(
  caso.resposta.statusCode === 200,
  'permite confirmar o único negócio que permanece aberto numa ambiguidade existente',
)
assert(
  caso.vinculo.fields.status === 'vinculado_manual',
  'reconcilia ambiguidade com um candidato atual',
)

caso = executar({ negocioIds: ['negocio-fora-da-lista'] })
assert(caso.resposta.statusCode === 400, 'rejeita negócio fora dos candidatos atuais')
assert(caso.salvos.length === 0, 'não grava seleção inválida')

caso = executar({ negocioIds: ['negocio-a'], status: 'vinculado_manual' })
assert(caso.resposta.statusCode === 409, 'falha fechada quando a ambiguidade já foi tratada')
assert(caso.salvos.length === 0, 'não sobrescreve decisão posterior')

caso = executar({ negocioIds: [] })
assert(caso.resposta.statusCode === 400, 'exige ao menos um negócio')
assert(caso.salvos.length === 0, 'não grava seleção vazia')

caso = executar({ negocioIds: ['negocio-a'], perfil: 'operador-comercial' })
assert(caso.resposta.statusCode === 403, 'restringe a decisão aos perfis autorizados')
assert(caso.salvos.length === 0, 'não grava decisão sem autorização')

caso = executar({ negocioIds: ['negocio-a'], perfil: 'integracao' })
assert(caso.resposta.statusCode === 403, 'perfil técnico não registra decisão humana')
assert(caso.salvos.length === 0, 'perfil técnico não altera vínculo')

caso = executar({ negocioIds: ['negocio-a'], perfilAtivo: false })
assert(caso.resposta.statusCode === 403, 'perfil inativo não registra decisão')
assert(caso.salvos.length === 0, 'perfil inativo não altera vínculo')

caso = executar({
  negocioIds: ['negocio-a'],
  candidatos: [candidatoA, candidatoOutraEquipe],
})
assert(caso.resposta.statusCode === 403, 'gestor não decide com candidato fora de sua equipe')
assert(caso.salvos.length === 0, 'escopo insuficiente não altera vínculo')

const cinquentaDaEquipe = Array.from(
  { length: 50 },
  (_, index) =>
    new MockRecord(`negocio-equipe-${index}`, {
      empresa_id: 'empresa-1',
      contato_principal_id: 'contato-1',
      equipe_id: 'equipe-1',
      responsavel_id: 'outro-usuario',
      resultado: '',
      inativo: false,
    }),
)
caso = executar({
  negocioIds: ['negocio-equipe-0'],
  candidatos: [...cinquentaDaEquipe, candidatoOutraEquipe],
})
assert(
  caso.resposta.statusCode === 403,
  'não ignora candidato fora do escopo depois dos primeiros 50 registros',
)
assert(caso.salvos.length === 0, 'paginação de escopo falha fechada sem gravar decisão')

const vinteEUmDaEquipe = Array.from(
  { length: 21 },
  (_, index) =>
    new MockRecord(`negocio-lote-${index}`, {
      empresa_id: 'empresa-1',
      contato_principal_id: 'contato-1',
      equipe_id: 'equipe-1',
      responsavel_id: 'outro-usuario',
      resultado: '',
      inativo: false,
    }),
)
caso = executar({
  negocioIds: vinteEUmDaEquipe.map((item) => item.id),
  candidatos: vinteEUmDaEquipe,
})
assert(caso.resposta.statusCode === 200, 'aceita decisão humana com mais de 20 negócios válidos')
assert(caso.salvos.length === 1, 'grava seleção ampla uma única vez')

const oitentaEUmDaEquipe = Array.from(
  { length: 81 },
  (_, index) =>
    new MockRecord(`negocio-limite-${index}`, {
      empresa_id: 'empresa-1',
      contato_principal_id: 'contato-1',
      equipe_id: 'equipe-1',
      responsavel_id: 'outro-usuario',
      resultado: '',
      inativo: false,
    }),
)
caso = executar({
  negocioIds: ['negocio-limite-0'],
  candidatos: oitentaEUmDaEquipe,
})
assert(
  caso.resposta.statusCode === 409,
  'rejeita decisão quando os candidatos excedem o limite seguro',
)
assert(
  caso.resposta.body.error === 'SELECAO_MUITO_AMPLA',
  'retorna erro específico para seleção ampla',
)
assert(caso.salvos.length === 0, 'não persiste seleção incompatível com o limite do campo')

for (const collectionName of [
  'com_whatsapp_eventos',
  'com_whatsapp_mensagens',
  'com_whatsapp_midias',
  'com_ledger_comercial',
  'com_whatsapp_vinculos',
]) {
  const collection = schema.collections.find((item) => item.name === collectionName)
  assert(collection?.apiRules?.list === null, `${collectionName} não permite listagem pela API`)
  assert(collection?.apiRules?.view === null, `${collectionName} não permite leitura pela API`)
  assert(
    lockdownMigration.includes(`'${collectionName}'`),
    `${collectionName} é fechada por migração`,
  )
}
const colecoesExpostas = Object.fromEntries(
  [
    'com_whatsapp_eventos',
    'com_whatsapp_mensagens',
    'com_whatsapp_midias',
    'com_ledger_comercial',
    'com_whatsapp_vinculos',
  ].map((nome) => [
    nome,
    { name: nome, listRule: 'regra permissiva', viewRule: 'regra permissiva' },
  ]),
)
const colecoesSalvas = []
aplicarLockdown({
  findCollectionByNameOrId(nome) {
    return colecoesExpostas[nome]
  },
  save(collection) {
    colecoesSalvas.push(collection.name)
  },
})
assert(colecoesSalvas.length === 5, 'migração corretiva atualiza todas as coleções sensíveis')
assert(
  Object.values(colecoesExpostas).every(
    (collection) => collection.listRule === null && collection.viewRule === null,
  ),
  'migração corretiva fecha listagem e leitura da cadeia materializada',
)
assert(
  source.includes("var ambiguos = carregarRegistros(\n        'com_whatsapp_vinculos'") &&
    source.includes('if (ambiguidadesNegociosAbertos.length >= 10) break'),
  'aplica o limite da fila somente depois do filtro de autorização',
)

assert(!source.includes('$http.send'), 'não cria caminho de envio de mensagem WhatsApp')
assert(source.includes('automatic_send_allowed: false'), 'mantém envio automático desativado')
assert(source.includes("modo: 'captura_passiva'"), 'mantém a captura passiva')
