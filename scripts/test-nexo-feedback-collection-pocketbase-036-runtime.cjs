const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')
const { spawn, spawnSync } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const pocketbase = process.env.POCKETBASE_BIN
assert(pocketbase, 'POCKETBASE_BIN must point to a PocketBase 0.36.x binary')
assert(fs.existsSync(pocketbase), `PocketBase binary not found: ${pocketbase}`)

const source = fs.readFileSync(
  path.join(root, 'pocketbase/hooks/com_propostas_operacao.js'),
  'utf8',
)
function extractFunction(text, name) {
  const start = text.indexOf(`function ${name}(`)
  assert.notEqual(start, -1, `${name} deve existir`)
  const brace = text.indexOf('{', start)
  let depth = 0
  let quote = ''
  let escaped = false
  for (let i = brace; i < text.length; i += 1) {
    const ch = text[i]
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
    if (ch === '}' && --depth === 0) return text.slice(start, i + 1)
  }
  throw new Error(`função ${name} não termina`)
}

const workspace = fs.mkdtempSync(
  path.join(process.env.TMPDIR || os.tmpdir(), 'nexo-feedback-pb036-'),
)
const dataDirectory = path.join(workspace, 'data')
const migrationsDirectory = path.join(workspace, 'migrations')
const hooksDirectory = path.join(workspace, 'hooks')
const emptyHooksDirectory = path.join(workspace, 'empty-hooks')
for (const dir of [migrationsDirectory, hooksDirectory, emptyHooksDirectory])
  fs.mkdirSync(dir, { recursive: true })

const migration = `migrate(function (app) {
  var collection = new Collection({
    type: 'base',
    name: 'com_nexo_sugestao_feedback_v1',
    createRule: '', updateRule: '', deleteRule: '', listRule: '', viewRule: '',
  })
  collection.fields.add(new TextField({ name: 'external_id', required: false, max: 10 }))
  collection.indexes = ['CREATE INDEX idx_feedback_operacional_extra ON com_nexo_sugestao_feedback_v1 (external_id)']
  app.save(collection)
}, function (_) {})
`
const hook = `routerAdd('GET', '/__test/nexo-feedback-schema', function (e) {
  ${extractFunction(source, 'garantirColecaoFeedback')}
  try {
    var collection = garantirColecaoFeedback($app)
    var fields = []
    for (var i = 0; i < collection.fields.length; i++) {
      var field = collection.fields[i]
      if (['external_id','audit_id','resultado','usuario_id','created_at'].indexOf(field.name) >= 0) {
        fields.push({ name: field.name, type: field.type(), required: field.required, max: field.max || 0 })
      }
    }
    return e.json(200, {
      rules_closed: collection.createRule === null && collection.updateRule === null && collection.deleteRule === null && collection.listRule === null && collection.viewRule === null,
      fields: fields,
      indexes: collection.indexes,
    })
  } catch (error) {
    return e.json(500, { error: String(error) })
  }
})
`
fs.writeFileSync(path.join(migrationsDirectory, '202611020001_setup.js'), migration)
fs.writeFileSync(path.join(hooksDirectory, 'zz_nexo_feedback_probe.pb.js'), hook)

function migrate() {
  const result = spawnSync(
    pocketbase,
    [
      'migrate',
      'up',
      '--dir',
      dataDirectory,
      '--migrationsDir',
      migrationsDirectory,
      '--hooksDir',
      emptyHooksDirectory,
      '--dev=false',
    ],
    { cwd: root, encoding: 'utf8' },
  )
  assert.equal(
    result.status,
    0,
    `PocketBase migration failed\n${result.stdout || ''}${result.stderr || ''}`,
  )
}
function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close((error) => (error ? reject(error) : resolve(port)))
    })
  })
}
function request(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => (raw += chunk))
      res.on('end', () => {
        let body = null
        try {
          body = JSON.parse(raw)
        } catch (_) {}
        resolve({ status: res.statusCode, body, raw })
      })
    })
    req.once('error', reject)
  })
}
async function waitForReady(baseUrl, server, output) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`PocketBase exited\n${output()}`)
    try {
      const health = await request(`${baseUrl}/api/health`)
      if (health.status === 200) return
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`PocketBase readiness timeout\n${output()}`)
}
async function stopServer(server) {
  if (server.exitCode !== null) return
  server.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => server.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ])
  if (server.exitCode === null) server.kill('SIGKILL')
}

async function main() {
  migrate()
  const port = await reservePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const server = spawn(
    pocketbase,
    [
      'serve',
      `--http=127.0.0.1:${port}`,
      '--dir',
      dataDirectory,
      '--migrationsDir',
      migrationsDirectory,
      '--hooksDir',
      hooksDirectory,
      '--dev=false',
    ],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let stdout = ''
  let stderr = ''
  server.stdout.on('data', (chunk) => (stdout += chunk))
  server.stderr.on('data', (chunk) => (stderr += chunk))
  try {
    await waitForReady(baseUrl, server, () => stdout + stderr)
    const first = await request(`${baseUrl}/__test/nexo-feedback-schema`)
    assert.equal(
      first.status,
      200,
      `first schema reconciliation failed: ${first.raw}\n${stdout}${stderr}`,
    )
    assert.equal(first.body.rules_closed, true)
    assert.deepEqual(
      first.body.fields.map((field) => [field.name, field.type, field.required]),
      [
        ['external_id', 'text', true],
        ['audit_id', 'text', true],
        ['resultado', 'text', true],
        ['usuario_id', 'text', true],
        ['created_at', 'date', true],
      ],
    )
    assert.equal(first.body.fields[0].max, 80)
    assert(first.body.indexes.some((index) => index.includes('idx_feedback_operacional_extra')))
    assert(first.body.indexes.some((index) => index.includes('idx_nexo_feedback_audit_usuario')))
    assert(first.body.indexes.some((index) => index.includes('idx_nexo_feedback_external_created')))
    const second = await request(`${baseUrl}/__test/nexo-feedback-schema`)
    assert.equal(second.status, 200, `second idempotent reconciliation failed: ${second.raw}`)
    assert.deepEqual(second.body, first.body)
    console.log('PocketBase 0.36 Nexo feedback collection runtime: PASS')
  } finally {
    await stopServer(server)
  }
}

main()
  .catch((error) => {
    console.error(error && error.stack ? error.stack : error)
    process.exitCode = 1
  })
  .finally(() => fs.rmSync(workspace, { recursive: true, force: true }))
