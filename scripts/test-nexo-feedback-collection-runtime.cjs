const fs = require('node:fs')
const vm = require('node:vm')
const assert = require('node:assert/strict')

const hook = fs.readFileSync('pocketbase/hooks/com_propostas_operacao.js', 'utf8')

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`)
  assert.notEqual(start, -1, `${name} deve existir`)
  const brace = source.indexOf('{', start)
  let depth = 0
  let quote = ''
  let escaped = false
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i]
    if (quote) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === quote) quote = ''
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '{') depth += 1
    if (ch === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  throw new Error(`função ${name} não termina`)
}

class Fields {
  constructor(items = []) {
    this.items = items
  }
  add(field) {
    this.items.push(field)
  }
  getByName(name) {
    return this.items.find((field) => field.name === name) || null
  }
}
class Collection {
  constructor(input) {
    Object.assign(this, input)
    this.fields = new Fields()
    this.indexes = input.indexes || []
    this.id = input.id || ''
  }
}
class TextField {
  constructor(input) {
    Object.assign(this, input)
  }
  type() {
    return 'text'
  }
}
class DateField {
  constructor(input) {
    Object.assign(this, input)
  }
  type() {
    return 'date'
  }
}

function loadFunction() {
  const sandbox = { Collection, TextField, DateField }
  vm.createContext(sandbox)
  vm.runInContext(
    `${extractFunction(hook, 'garantirColecaoFeedback')}; this.ensure = garantirColecaoFeedback`,
    sandbox,
  )
  return sandbox.ensure
}

function appWith(initial, options = {}) {
  let collection = initial || null
  let saves = 0
  return {
    findCollectionByNameOrId() {
      if (!collection) throw new Error('missing')
      return collection
    },
    save(value) {
      saves += 1
      if (options.raceOnFirstSave && saves === 1) {
        collection = options.raceWinner
        throw new Error('duplicate collection name')
      }
      value.id ||= 'feedback0000001'
      collection = value
    },
    state() {
      return { collection, saves }
    },
  }
}

const ensure = loadFunction()

const createdApp = appWith(null)
const created = ensure(createdApp)
assert.equal(created.name, 'com_nexo_sugestao_feedback_v1')
assert.deepEqual(
  Array.from(created.fields.items, (field) => [field.name, field.type, field.required]),
  [
    ['external_id', TextField.prototype.type, true],
    ['audit_id', TextField.prototype.type, true],
    ['resultado', TextField.prototype.type, true],
    ['usuario_id', TextField.prototype.type, true],
    ['created_at', DateField.prototype.type, true],
  ],
)
assert.equal(created.listRule, null)
assert.equal(created.viewRule, null)
assert.equal(created.createRule, null)
assert.equal(created.updateRule, null)
assert.equal(created.deleteRule, null)
assert.equal(created.indexes.length, 2)

const divergent = new Collection({
  id: 'feedback0000001',
  name: 'com_nexo_sugestao_feedback_v1',
  type: 'base',
  listRule: '',
  viewRule: '',
  createRule: '',
  updateRule: '',
  deleteRule: '',
})
divergent.fields.add(new TextField({ name: 'external_id', required: false, max: 10 }))
divergent.indexes = ['CREATE INDEX idx_feedback_operacional_extra ON com_nexo_sugestao_feedback_v1 (resultado)']
const repairApp = appWith(divergent)
const repaired = ensure(repairApp)
assert.equal(repaired.fields.getByName('external_id').required, true)
assert.equal(repaired.fields.getByName('external_id').max, 80)
assert.equal(repaired.fields.getByName('created_at').type(), 'date')
assert.equal(repaired.listRule, null)
assert.equal(repaired.indexes.length, 3)
assert.match(repaired.indexes[0], /idx_feedback_operacional_extra/)
assert.equal(repairApp.state().saves, 1)

const raceWinner = new Collection({
  id: 'feedback0000002',
  name: 'com_nexo_sugestao_feedback_v1',
  type: 'base',
  listRule: null,
  viewRule: null,
  createRule: null,
  updateRule: null,
  deleteRule: null,
})
const raceApp = appWith(null, { raceOnFirstSave: true, raceWinner })
const afterRace = ensure(raceApp)
assert.equal(afterRace.id, 'feedback0000002')
assert.equal(afterRace.fields.getByName('audit_id').max, 160)
assert.equal(raceApp.state().saves, 2)

const incompatible = new Collection({
  id: 'feedback0000003',
  name: 'com_nexo_sugestao_feedback_v1',
  type: 'base',
  listRule: null,
  viewRule: null,
  createRule: null,
  updateRule: null,
  deleteRule: null,
})
incompatible.fields.add(new DateField({ name: 'external_id', required: true }))
assert.throws(() => ensure(appWith(incompatible)), /SCHEMA_FEEDBACK_INCOMPATIVEL/)

console.log('nexo feedback collection runtime: PASS')
