const fs = require('fs')
const path = require('path')
const vm = require('vm')

const migrationPath = path.resolve(
  __dirname,
  '../pocketbase/migrations/202609302330_whatsapp_multi_negocio.js',
)
const source = fs.readFileSync(migrationPath, 'utf8')
let aplicar
let reverter
vm.runInNewContext(source, {
  migrate(up, down) {
    aplicar = up
    reverter = down
  },
  JSONField: function JSONField(definition) {
    Object.assign(this, definition)
  },
  Date,
  Array,
  Error,
})

function assert(name, condition) {
  if (!condition) {
    console.error(`FAIL ${name}`)
    process.exit(1)
  }
  console.log(`OK ${name}`)
}

const OBSERVACAO_ANTERIOR =
  'PILOTO_NEXO_TELEGRAM: múltiplos negócios abertos para o mesmo contato/empresa. Operador=Cristiane PMais; negócios_abertos=q3g119zt7r9g0tv|Proposta Qualificada|resultado=aberto; mgic724qec8mz20|Proposta Qualificada|resultado=aberto'
const OBSERVACAO_NOVA =
  'Decisão de Lula Moura: o diálogo trata conjuntamente das propostas de limpeza e vigilante desarmado; vinculado aos dois negócios.'
const VINCULADO_EM_MIGRACAO = '2026-09-30T23:30:00.000Z'

class FakeRecord {
  constructor(data) {
    this.data = { ...data }
  }
  getString(name) {
    const value = this.data[name]
    return value === null || value === undefined ? '' : String(value)
  }
  get(name) {
    return this.data[name]
  }
  set(name, value) {
    this.data[name] = value
  }
}

class FakeFields {
  constructor(withMultiField) {
    this.items = new Map()
    if (withMultiField) this.items.set('negocio_ids', { name: 'negocio_ids' })
  }
  getByName(name) {
    return this.items.get(name) || null
  }
  add(field) {
    this.items.set(field.name, field)
  }
}

function createApp({ withMultiField = false, target = {} } = {}) {
  const collection = { name: 'com_whatsapp_vinculos', fields: new FakeFields(withMultiField) }
  const targetRecord = new FakeRecord({
    provider: 'uazapi',
    instance_name: 'Cristiane PMais',
    owner: '558183966723',
    chat_id: '558173434439@s.whatsapp.net',
    contato_id: 'oct8omr1j1pdaj1',
    empresa_id: 'heiwkslfa65akw8',
    negocio_id: '',
    negocio_ids: withMultiField ? [] : undefined,
    status: 'ambiguidade_negocio_aberto',
    origem_decisao: 'sistema_multiplos_negocios_abertos_piloto_nexo_telegram',
    observacao: OBSERVACAO_ANTERIOR,
    vinculado_em: '',
    ...target,
  })
  const negocios = {
    q3g119zt7r9g0tv: new FakeRecord({ id: 'q3g119zt7r9g0tv' }),
    mgic724qec8mz20: new FakeRecord({ id: 'mgic724qec8mz20' }),
  }
  const saves = []
  return {
    collection,
    targetRecord,
    saves,
    findCollectionByNameOrId(name) {
      if (name !== 'com_whatsapp_vinculos') throw new Error(`collection ${name} ausente`)
      return collection
    },
    findRecordById(collectionName, id) {
      if (collectionName === 'com_whatsapp_vinculos' && id === '9ktk4n5hvxiwx4p')
        return targetRecord
      if (collectionName === 'com_negocios' && negocios[id]) return negocios[id]
      throw new Error(`record ${collectionName}/${id} ausente`)
    },
    save(value) {
      saves.push(value)
    },
  }
}

assert(
  'migração expõe aplicação e reversão executáveis',
  typeof aplicar === 'function' && typeof reverter === 'function',
)

const autorizado = createApp()
aplicar(autorizado)
assert('aplicação cria campo negocio_ids', autorizado.collection.fields.getByName('negocio_ids'))
assert(
  'aplicação vincula exatamente os dois negócios autorizados',
  autorizado.targetRecord.getString('status') === 'vinculado_multiplo' &&
    autorizado.targetRecord.getString('origem_decisao') ===
      'decisao_humana_dialogo_multiplos_negocios' &&
    autorizado.targetRecord.get('negocio_ids').length === 2 &&
    autorizado.targetRecord.get('negocio_ids').includes('q3g119zt7r9g0tv') &&
    autorizado.targetRecord.get('negocio_ids').includes('mgic724qec8mz20') &&
    autorizado.targetRecord.getString('vinculado_em') === VINCULADO_EM_MIGRACAO,
)

const savesDepoisPrimeiraAplicacao = autorizado.saves.length
aplicar(autorizado)
assert(
  'segunda aplicação é idempotente',
  autorizado.saves.length === savesDepoisPrimeiraAplicacao &&
    autorizado.targetRecord.getString('observacao') === OBSERVACAO_NOVA,
)

function assertAplicacaoRejeitada(nome, options, verificar) {
  const app = createApp(options)
  let falhouFechado = false
  try {
    aplicar(app)
  } catch (_) {
    falhouFechado = true
  }
  assert(
    nome,
    falhouFechado &&
      app.saves.length === 0 &&
      verificar(app) &&
      (options.withMultiField || !app.collection.fields.getByName('negocio_ids')),
  )
}

assertAplicacaoRejeitada(
  'aplicação rejeita observação posterior sem alterar registro ou schema',
  { target: { observacao: 'Decisão posterior já registrada' } },
  (app) => app.targetRecord.getString('observacao') === 'Decisão posterior já registrada',
)
assertAplicacaoRejeitada(
  'aplicação rejeita negocio_ids previamente preenchido',
  {
    withMultiField: true,
    target: { negocio_ids: ['decisao-anterior'] },
  },
  (app) => app.targetRecord.get('negocio_ids')[0] === 'decisao-anterior',
)
assertAplicacaoRejeitada(
  'aplicação rejeita vinculado_em previamente preenchido',
  { target: { vinculado_em: '2026-09-30T22:00:00.000Z' } },
  (app) => app.targetRecord.getString('vinculado_em') === '2026-09-30T22:00:00.000Z',
)

reverter(autorizado)
assert(
  'rollback exato restaura o estado anterior sem remover o campo compartilhado',
  autorizado.targetRecord.getString('status') === 'ambiguidade_negocio_aberto' &&
    autorizado.targetRecord.getString('origem_decisao') ===
      'sistema_multiplos_negocios_abertos_piloto_nexo_telegram' &&
    autorizado.targetRecord.getString('observacao') === OBSERVACAO_ANTERIOR &&
    autorizado.targetRecord.get('negocio_ids').length === 0 &&
    autorizado.collection.fields.getByName('negocio_ids'),
)

const ESTADO_POS_MIGRACAO = {
  provider: 'uazapi',
  instance_name: 'Cristiane PMais',
  owner: '558183966723',
  chat_id: '558173434439@s.whatsapp.net',
  contato_id: 'oct8omr1j1pdaj1',
  empresa_id: 'heiwkslfa65akw8',
  negocio_id: '',
  negocio_ids: ['q3g119zt7r9g0tv', 'mgic724qec8mz20'],
  status: 'vinculado_multiplo',
  origem_decisao: 'decisao_humana_dialogo_multiplos_negocios',
  observacao: OBSERVACAO_NOVA,
  vinculado_em: VINCULADO_EM_MIGRACAO,
}

function assertRollbackPreservaDivergencia(nome, target, campo, valorEsperado) {
  const app = createApp({
    withMultiField: true,
    target: { ...ESTADO_POS_MIGRACAO, ...target },
  })
  reverter(app)
  assert(
    nome,
    app.saves.length === 0 &&
      JSON.stringify(app.targetRecord.get(campo)) === JSON.stringify(valorEsperado) &&
      app.collection.fields.getByName('negocio_ids'),
  )
}

assertRollbackPreservaDivergencia(
  'rollback não sobrescreve observação posterior',
  { observacao: 'Decisão posterior alterada por outro fluxo' },
  'observacao',
  'Decisão posterior alterada por outro fluxo',
)
assertRollbackPreservaDivergencia(
  'rollback não sobrescreve negocio_ids posterior',
  { negocio_ids: ['outro-negocio'] },
  'negocio_ids',
  ['outro-negocio'],
)
assertRollbackPreservaDivergencia(
  'rollback não sobrescreve vinculado_em posterior',
  { vinculado_em: '2026-10-01T00:00:00.000Z' },
  'vinculado_em',
  '2026-10-01T00:00:00.000Z',
)
assertRollbackPreservaDivergencia(
  'rollback não sobrescreve contato posterior',
  { contato_id: 'contato-posterior' },
  'contato_id',
  'contato-posterior',
)
assertRollbackPreservaDivergencia(
  'rollback não sobrescreve empresa posterior',
  { empresa_id: 'empresa-posterior' },
  'empresa_id',
  'empresa-posterior',
)
assertRollbackPreservaDivergencia(
  'rollback não atua em outra identidade de conversa',
  { chat_id: 'outra-conversa@s.whatsapp.net' },
  'chat_id',
  'outra-conversa@s.whatsapp.net',
)

console.log('Comportamento da migração de vínculo múltiplo validado')
