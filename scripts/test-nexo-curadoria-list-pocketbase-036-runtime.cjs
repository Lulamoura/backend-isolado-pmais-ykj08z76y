const assert = require('assert')
const fs = require('fs')
const http = require('http')
const net = require('net')
const os = require('os')
const path = require('path')
const { spawn, spawnSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const pocketbase = process.env.POCKETBASE_BIN
assert(pocketbase, 'POCKETBASE_BIN must point to a PocketBase 0.36.x binary')
assert(fs.existsSync(pocketbase), `PocketBase binary not found: ${pocketbase}`)

const workspace = fs.mkdtempSync(
  path.join(process.env.TMPDIR || os.tmpdir(), 'nexo-curadoria-list-pb036-'),
)
const dataDirectory = path.join(workspace, 'data')
const migrationsDirectory = path.join(workspace, 'migrations')
const hooksDirectory = path.join(workspace, 'hooks')
const emptyHooksDirectory = path.join(workspace, 'empty-hooks')
fs.mkdirSync(migrationsDirectory, { recursive: true })
fs.mkdirSync(hooksDirectory, { recursive: true })
fs.mkdirSync(emptyHooksDirectory, { recursive: true })

const email = 'curadoria-runtime@example.test'
const password = 'test-password-12345'

const setupMigration = `migrate(
  function (app) {
    var eventos = new Collection({ type: 'base', name: 'com_nexo_aprendizado_eventos', createRule: null, updateRule: null, deleteRule: null, listRule: null, viewRule: null })
    app.save(eventos)

    var ledger = new Collection({ type: 'base', name: 'com_ledger_comercial', createRule: null, updateRule: null, deleteRule: null, listRule: null, viewRule: null })
    ledger.fields.add(new TextField({ name: 'audit_id', required: true, max: 160 }))
    app.save(ledger)

    var decisoes = new Collection({ type: 'base', name: 'com_nexo_curadoria_decisoes', createRule: null, updateRule: null, deleteRule: null, listRule: null, viewRule: null })
    app.save(decisoes)

    var perfis = new Collection({ type: 'base', name: 'com_perfis', createRule: null, updateRule: null, deleteRule: null, listRule: null, viewRule: null })
    perfis.fields.add(new TextField({ name: 'slug', required: true, max: 80 }))
    perfis.fields.add(new BoolField({ name: 'ativo', required: false }))
    app.save(perfis)
    var perfil = new Record(perfis)
    perfil.id = 'prof00000000001'
    perfil.set('slug', 'superadministrador')
    perfil.set('ativo', true)
    app.save(perfil)

    var users = app.findCollectionByNameOrId('users')
    users.listRule = null
    users.viewRule = null
    users.createRule = null
    users.updateRule = null
    users.deleteRule = null
    users.manageRule = null
    users.fields.add(new BoolField({ name: 'ativo_comercial', required: false }))
    users.fields.add(new TextField({ name: 'perfil_id', required: false, max: 80 }))
    users.fields.add(new TextField({ name: 'equipe_id', required: false, max: 80 }))
    app.save(users)
    var user = new Record(users)
    user.id = 'user00000000001'
    user.set('email', '${email}')
    user.set('password', '${password}')
    user.set('verified', true)
    user.set('ativo_comercial', true)
    user.set('perfil_id', perfil.id)
    app.save(user)
  },
  function (_) {},
)
`

const schemaProbeHook = `routerAdd('GET', '/__test/curadoria-schema', function (e) {
  var collection = $app.findCollectionByNameOrId('com_nexo_curadoria_casos')
  var fields = []
  for (var i = 0; i < collection.fields.length; i++) fields.push(collection.fields[i].name)
  return e.json(200, {
    collection: collection.name,
    fields: fields,
    has_updated: collection.fields.getByName('updated') !== null,
  })
})
`

fs.writeFileSync(path.join(migrationsDirectory, '202610012105_setup.js'), setupMigration)
fs.copyFileSync(
  path.join(root, 'pocketbase', 'migrations', '202610012340_nexo_curadoria_schema_recovery.js'),
  path.join(migrationsDirectory, '202610012340_nexo_curadoria_schema_recovery.js'),
)
fs.copyFileSync(
  path.join(root, 'pocketbase', 'hooks', 'com_propostas_operacao.js'),
  path.join(hooksDirectory, 'com_propostas_operacao.pb.js'),
)
fs.writeFileSync(path.join(hooksDirectory, 'zz_curadoria_schema_probe.pb.js'), schemaProbeHook)

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
  const output = `${result.stdout || ''}${result.stderr || ''}`
  assert.strictEqual(result.status, 0, `PocketBase recovery migration failed\n${output}`)
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close((error) => {
        if (error) reject(error)
        else resolve(address.port)
      })
    })
  })
}

function request(url, options = {}, body) {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const payload = body === undefined ? null : JSON.stringify(body)
    const req = http.request(
      target,
      {
        method: options.method || 'GET',
        headers: {
          ...(payload
            ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
            : {}),
          ...(options.headers || {}),
        },
      },
      (res) => {
        let raw = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          raw += chunk
        })
        res.on('end', () => {
          let parsed = null
          try {
            parsed = raw ? JSON.parse(raw) : null
          } catch (_) {}
          resolve({ status: res.statusCode, body: parsed, raw })
        })
      },
    )
    req.once('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

async function waitForReady(baseUrl, processState) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (processState.exitCode !== null) {
      throw new Error(`PocketBase exited before readiness\n${processState.output()}`)
    }
    try {
      const health = await request(`${baseUrl}/api/health`)
      if (health.status === 200) return
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`PocketBase did not become ready\n${processState.output()}`)
}

async function stopServer(server) {
  if (!server || server.exitCode !== null) return
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
  server.stdout.on('data', (chunk) => {
    stdout += chunk
  })
  server.stderr.on('data', (chunk) => {
    stderr += chunk
  })
  const processState = {
    get exitCode() {
      return server.exitCode
    },
    output: () => `${stdout}${stderr}`,
  }

  try {
    await waitForReady(baseUrl, processState)

    const schema = await request(`${baseUrl}/__test/curadoria-schema`)
    assert.strictEqual(schema.status, 200, `schema probe failed: ${schema.status} ${schema.raw}`)
    assert.strictEqual(schema.body.collection, 'com_nexo_curadoria_casos')
    assert.strictEqual(
      schema.body.has_updated,
      false,
      'recovery schema must leave com_nexo_curadoria_casos without an updated field',
    )
    assert.strictEqual(schema.body.fields.includes('updated'), false)

    const auth = await request(
      `${baseUrl}/api/collections/users/auth-with-password`,
      { method: 'POST' },
      { identity: email, password },
    )
    assert.strictEqual(auth.status, 200, `canonical user authentication failed: ${auth.raw}`)
    assert(auth.body.token, 'canonical user authentication must return a token')
    assert.strictEqual(auth.body.record.id, 'user00000000001')
    assert.strictEqual(auth.body.record.ativo_comercial, true)
    assert.strictEqual(auth.body.record.perfil_id, 'prof00000000001')

    console.log(
      `PocketBase 0.36 Curadoria preconditions: collection=${schema.body.collection} has_updated=${schema.body.has_updated} canonical_user=${auth.body.record.id} ativo_comercial=${auth.body.record.ativo_comercial} perfil_id=${auth.body.record.perfil_id}`,
    )

    const listed = await request(
      `${baseUrl}/backend/v1/nexo/curadoria/casos/listar`,
      { method: 'POST', headers: { Authorization: auth.body.token } },
      { limite: 50 },
    )
    assert.strictEqual(
      listed.status,
      200,
      `Curadoria list route must return 200, received ${listed.status}: ${listed.raw}`,
    )
    assert.strictEqual(listed.body.ok, true)
    assert.deepStrictEqual(listed.body.contadores, {
      para_tratar: 0,
      aguardando_decisao: 0,
      conhecimento_aprovado: 0,
      historico: 0,
    })

    console.log(
      `PocketBase 0.36 Curadoria list runtime: PASS status=${listed.status} ok=${listed.body.ok} counters=${JSON.stringify(listed.body.contadores)} has_updated=${schema.body.has_updated}`,
    )
  } finally {
    await stopServer(server)
  }
}

main()
  .catch((error) => {
    console.error(error && error.stack ? error.stack : error)
    process.exitCode = 1
  })
  .finally(() => {
    fs.rmSync(workspace, { recursive: true, force: true })
  })
