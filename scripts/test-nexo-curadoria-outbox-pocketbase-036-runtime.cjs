const assert = require('assert')
const crypto = require('crypto')
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
  path.join(process.env.TMPDIR || os.tmpdir(), 'nexo-curadoria-outbox-pb036-'),
)
const dataDirectory = path.join(workspace, 'data')
const migrationsDirectory = path.join(workspace, 'migrations')
const hooksDirectory = path.join(workspace, 'hooks')
const emptyHooksDirectory = path.join(workspace, 'empty-hooks')
fs.mkdirSync(migrationsDirectory, { recursive: true })
fs.mkdirSync(hooksDirectory, { recursive: true })
fs.mkdirSync(emptyHooksDirectory, { recursive: true })

const email = 'curadoria-outbox@example.test'
const password = 'test-password-12345'
const caseId = 'case00000000002'
const gatewayApiKey = 'pb036-gateway-api-key'
const gatewayHmacSecret = 'pb036-transport-hmac-secret'
const approvalHmacSecret = 'pb036-approval-hmac-secret'
const businessSources = ['whatsapp_uazapi', 'activecampaign']
const interviewAnswers = [
  'Orientar o registro do próximo passo.',
  'Não aplicar sem validação humana.',
  'Registrar a decisão no negócio.',
  'Regra validada em curadoria autenticada.',
]
const sourceMigrations = [
  '202610012100_nexo_aprendizado_whatsapp_proveniencia.js',
  '202610012110_nexo_curadoria_decisoes_acl_fail_closed.js',
  '202610012220_nexo_curadoria_comercial_unificada.js',
  '202610012300_nexo_curadoria_review_hardening.js',
  '202610012330_nexo_curadoria_fail_closed.js',
  '202610012340_nexo_curadoria_schema_recovery.js',
  '202610012350_nexo_curadoria_outbox_zero_attempt.js',
]

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value
      .map((item) => {
        const serialized = canonicalJson(item)
        return serialized === undefined ? 'null' : serialized
      })
      .join(',')}]`
  }
  return `{${Object.keys(value)
    .sort()
    .flatMap((key) => {
      const serialized = canonicalJson(value[key])
      return serialized === undefined ? [] : [`${JSON.stringify(key)}:${serialized}`]
    })
    .join(',')}}`
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function hmac(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex')
}

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

const seedCaseMigration = `migrate(
  function (app) {
    var caso = new Record(app.findCollectionByNameOrId('com_nexo_curadoria_casos'))
    caso.id = '${caseId}'
    caso.set('fingerprint', 'pb036-outbox-jsonraw-case')
    caso.set('revisao', 1)
    caso.set('status', 'aberto_curadoria')
    caso.set('fonte_principal', 'whatsapp_uazapi')
    caso.set('fontes', ${JSON.stringify(businessSources)})
    caso.set('escopo_tipo', 'negocio')
    caso.set('assunto_chave', 'rotina_comercial')
    caso.set('recorrencia_chave', 'pb036-jsonraw-canonical')
    caso.set('titulo', 'Caso PocketBase 0.36 JSONRaw')
    caso.set('resumo_factual', 'Caso real para validar publicação canônica da curadoria.')
    caso.set('motivo_curadoria', 'Cobrir JSONRaw, hashes e assinaturas no runtime real.')
    caso.set('regra_candidata', 'Registrar orientação comercial validada por curadoria humana.')
    caso.set('evidencia_contagem', 2)
    caso.set('casos_independentes', 2)
    caso.set('recorrencia_contagem', 2)
    caso.set('risco_classe', 'baixo')
    caso.set('alcada', 'gestao_comercial')
    caso.set('sensivel_motivos', [])
    caso.set('confianca', 'alta')
    caso.set('human_review_required', true)
    caso.set('automatic_promotion_allowed', false)
    caso.set('entrevista_respostas', ${JSON.stringify(interviewAnswers)})
    caso.set('entrevista_etapa', 4)
    caso.set('first_seen_at', '2026-10-01 12:00:00.000Z')
    caso.set('last_seen_at', '2026-10-01 12:00:00.000Z')
    app.save(caso)
  },
  function (_) {},
)
`

const stateProbeHook = `routerAdd('GET', '/__test/curadoria-outbox-state', function (e) {
  function jsonValue(record, field) {
    try {
      var raw = record.get(field)
      if (typeof raw === 'string') return JSON.parse(raw)
      if (raw && raw.toString) return JSON.parse(String(raw))
      return raw
    } catch (_) {
      return null
    }
  }
  var caso = $app.findRecordById('com_nexo_curadoria_casos', '${caseId}')
  var rows = $app.findRecordsByFilter('com_nexo_curadoria_outbox', "caso_id = '${caseId}'", '-caso_revisao', 10, 0)
  var outbox = rows.length ? rows[0] : null
  return e.json(200, {
    caso: {
      revisao: caso.getInt('revisao'),
      status: caso.getString('status'),
      conhecimento_status: caso.getString('conhecimento_status'),
    },
    outbox_count: rows.length,
    outbox: outbox ? {
      status: outbox.getString('status'),
      tentativas: outbox.getInt('tentativas'),
      last_error: outbox.getString('last_error'),
      payload_hash: outbox.getString('payload_hash'),
      payload_json: jsonValue(outbox, 'payload_json'),
    } : null,
  })
})

routerAdd('POST', '/__test/curadoria-outbox-seed-legacy-hash', function (e) {
  function jsonValue(record, field) {
    try {
      var raw = record.get(field)
      if (typeof raw === 'string') return JSON.parse(raw)
      if (raw && raw.toString) return JSON.parse(String(raw))
      return raw
    } catch (_) {
      return null
    }
  }
  var rows = $app.findRecordsByFilter('com_nexo_curadoria_outbox', "caso_id = '${caseId}'", '-id', 10, 0)
  if (rows.length !== 1) return e.json(409, { ok: false, error: 'OUTBOX_FIXTURE_INVALIDA' })
  var outbox = rows[0]
  var payload = jsonValue(outbox, 'payload_json')
  if (!payload || !payload.approval) return e.json(409, { ok: false, error: 'PAYLOAD_FIXTURE_INVALIDO' })
  var approval = payload.approval
  var legacyPayload = {
    schema_version: payload.schema_version,
    knowledge_ref: payload.knowledge_ref,
    action: payload.action,
    case_revision: payload.case_revision,
    title: payload.title,
    regra: payload.regra,
    exception: payload.exception,
    rationale: payload.rationale,
    subject: payload.subject,
    scope_type: payload.scope_type,
    sources: payload.sources,
    independent_cases: payload.independent_cases,
    independent_businesses: payload.independent_businesses,
    independent_conversations: payload.independent_conversations,
    confidence: payload.confidence,
    risk: payload.risk,
    approval: {
      approval_id: approval.approval_id,
      case_ref: approval.case_ref,
      case_revision: approval.case_revision,
      actor_id: approval.actor_id,
      actor_profile: approval.actor_profile,
      authority: approval.authority,
      action: approval.action,
      app_id: approval.app_id,
    },
  }
  var legacyHash = String($security.sha256(JSON.stringify(legacyPayload)))
  outbox.set('payload_hash', legacyHash)
  outbox.set('status', 'erro')
  outbox.set('next_attempt_at', null)
  outbox.set('last_error', 'FALHA_HISTORICA_ANTES_DA_CANONICALIZACAO')
  $app.save(outbox)
  return e.json(200, { ok: true, legacy_hash: legacyHash })
})
`

fs.writeFileSync(path.join(migrationsDirectory, '202610012000_setup.js'), setupMigration)
for (const name of sourceMigrations) {
  const source = path.join(root, 'pocketbase', 'migrations', name)
  assert(fs.existsSync(source), `migration missing from the real chain: ${name}`)
  fs.copyFileSync(source, path.join(migrationsDirectory, name))
}
fs.writeFileSync(path.join(migrationsDirectory, '202610012400_seed_case.js'), seedCaseMigration)
fs.copyFileSync(
  path.join(root, 'pocketbase', 'hooks', 'com_propostas_operacao.js'),
  path.join(hooksDirectory, 'com_propostas_operacao.pb.js'),
)
fs.writeFileSync(path.join(hooksDirectory, 'zz_curadoria_outbox_probe.pb.js'), stateProbeHook)

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
  assert.strictEqual(result.status, 0, `PocketBase migration chain failed\n${output}`)
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

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
}

function close(server) {
  return new Promise((resolve) => server.close(resolve))
}

async function readState(baseUrl) {
  const response = await request(`${baseUrl}/__test/curadoria-outbox-state`)
  assert.strictEqual(response.status, 200, `state probe failed: ${response.status} ${response.raw}`)
  return response.body
}

async function main() {
  migrate()
  const [gatewayPort, pocketbasePort] = await Promise.all([reservePort(), reservePort()])
  const gatewayBaseUrl = `http://127.0.0.1:${gatewayPort}`
  const baseUrl = `http://127.0.0.1:${pocketbasePort}`
  const gatewayCalls = []
  const gateway = http.createServer((req, res) => {
    let rawBody = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      rawBody += chunk
    })
    req.on('end', () => {
      let payload = null
      let validationError = null
      try {
        payload = JSON.parse(rawBody)
        assert.strictEqual(req.method, 'POST')
        assert.strictEqual(req.url, '/v1/comercial/nexo/curadoria/conhecimento')
        assert.strictEqual(req.headers['x-pmais-api-key'], gatewayApiKey)
        assert.strictEqual(
          rawBody,
          canonicalJson(payload),
          'outbound body must be recursive canonical JSON',
        )
        const payloadHash = sha256(rawBody)
        assert.strictEqual(req.headers['x-pmais-payload-hash'], payloadHash)
        const timestamp = req.headers['x-pmais-timestamp']
        assert(timestamp, 'transport timestamp must be present')
        assert.strictEqual(
          req.headers['x-pmais-signature'],
          hmac(`${timestamp}.${rawBody}`, gatewayHmacSecret),
          'transport HMAC must cover the exact outbound bytes',
        )
        assert.strictEqual(
          req.headers['x-pmais-approval-signature'],
          hmac(`${canonicalJson(payload.approval)}.${payloadHash}`, approvalHmacSecret),
          'approval HMAC must cover canonical approval plus the exact body hash',
        )
        assert.deepStrictEqual(payload.sources, businessSources)
      } catch (error) {
        validationError = error && error.message ? error.message : String(error)
      }
      gatewayCalls.push({ rawBody, payload, headers: req.headers, validationError })
      const response = validationError
        ? { ok: false, error: validationError }
        : {
            ok: true,
            readback_confirmed: true,
            payload_hash: req.headers['x-pmais-payload-hash'],
            knowledge_ref: payload.knowledge_ref,
            approval_id: payload.approval.approval_id,
            action: payload.action,
            case_revision: payload.case_revision,
            actor: {
              actor_id: payload.approval.actor_id,
              actor_profile: payload.approval.actor_profile,
              authority: payload.approval.authority,
              app_id: payload.approval.app_id,
            },
            audit_id: 'pb036-gateway-audit-1',
            version: 'pb036-gateway-version-1',
          }
      const responseBody = JSON.stringify(response)
      res.writeHead(validationError ? 400 : 200, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(responseBody),
      })
      res.end(responseBody)
    })
  })
  await listen(gateway, gatewayPort)

  const pocketbaseServer = spawn(
    pocketbase,
    [
      'serve',
      `--http=127.0.0.1:${pocketbasePort}`,
      '--dir',
      dataDirectory,
      '--migrationsDir',
      migrationsDirectory,
      '--hooksDir',
      hooksDirectory,
      '--dev=false',
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        PMAIS_AGENT_GATEWAY_URL: gatewayBaseUrl,
        PMAIS_CURADORIA_API_KEY: gatewayApiKey,
        PMAIS_CURADORIA_HMAC_SECRET: gatewayHmacSecret,
        PMAIS_CURADORIA_APPROVAL_SECRET: approvalHmacSecret,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let stdout = ''
  let stderr = ''
  pocketbaseServer.stdout.on('data', (chunk) => {
    stdout += chunk
  })
  pocketbaseServer.stderr.on('data', (chunk) => {
    stderr += chunk
  })
  const processState = {
    get exitCode() {
      return pocketbaseServer.exitCode
    },
    output: () => `${stdout}${stderr}`,
  }

  try {
    await waitForReady(baseUrl, processState)
    const auth = await request(
      `${baseUrl}/api/collections/users/auth-with-password`,
      { method: 'POST' },
      { identity: email, password },
    )
    assert.strictEqual(auth.status, 200, `canonical user authentication failed: ${auth.raw}`)
    assert(auth.body.token, 'canonical user authentication must return a token')
    const authenticated = { method: 'POST', headers: { Authorization: auth.body.token } }

    const approval = await request(
      `${baseUrl}/backend/v1/nexo/curadoria/casos/${caseId}/transicionar`,
      authenticated,
      {
        acao: 'aprovar',
        expected_revision: 1,
        regra_candidata: 'Registrar orientação comercial validada por curadoria humana.',
        decisao_observacao: 'Aprovação autenticada com publicação governada.',
      },
    )
    assert.strictEqual(approval.status, 200, `approval failed: ${approval.status} ${approval.raw}`)
    assert.strictEqual(approval.body.ok, true)

    const canonicalState = await readState(baseUrl)
    const canonicalHash = sha256(canonicalJson(canonicalState.outbox.payload_json))
    assert.strictEqual(
      canonicalState.outbox.payload_hash,
      canonicalHash,
      'new rows must start on the normal canonical path',
    )
    const seededLegacy = await request(
      `${baseUrl}/__test/curadoria-outbox-seed-legacy-hash`,
      { method: 'POST' },
      {},
    )
    assert.strictEqual(
      seededLegacy.status,
      200,
      `legacy fixture seed failed: ${seededLegacy.status} ${seededLegacy.raw}`,
    )
    const legacyState = await readState(baseUrl)
    assert.strictEqual(legacyState.outbox.status, 'erro')
    assert.strictEqual(legacyState.outbox.payload_hash, seededLegacy.body.legacy_hash)
    assert.notStrictEqual(
      legacyState.outbox.payload_hash,
      canonicalHash,
      'legacy fixture must reproduce a noncanonical historical hash',
    )
    assert.strictEqual(
      canonicalJson(legacyState.outbox.payload_json),
      canonicalJson(canonicalState.outbox.payload_json),
      'legacy fixture must preserve the authoritative persisted payload',
    )

    const processing = await request(
      `${baseUrl}/backend/v1/nexo/curadoria/outbox/processar`,
      authenticated,
      { limite: 10 },
    )
    const state = await readState(baseUrl)
    const processingAgain = await request(
      `${baseUrl}/backend/v1/nexo/curadoria/outbox/processar`,
      authenticated,
      { limite: 10 },
    )
    const stateAgain = await readState(baseUrl)
    const listed = await request(
      `${baseUrl}/backend/v1/nexo/curadoria/casos/listar`,
      authenticated,
      { limite: 50 },
    )
    const observation = {
      processing: { status: processing.status, body: processing.body },
      processing_again: { status: processingAgain.status, body: processingAgain.body },
      state,
      gateway_calls: gatewayCalls.length,
      gateway_error: gatewayCalls[0] ? gatewayCalls[0].validationError : null,
    }
    console.log(`PocketBase 0.36 Curadoria outbox observation: ${JSON.stringify(observation)}`)

    assert.strictEqual(processing.status, 200)
    assert.strictEqual(processing.body.processados, 1)
    assert.strictEqual(processing.body.falhas, 0)
    assert.strictEqual(state.caso.conhecimento_status, 'ativo')
    assert.strictEqual(state.outbox.status, 'processado')
    assert.strictEqual(state.outbox.last_error, '')
    assert.strictEqual(gatewayCalls.length, 1)
    assert.strictEqual(gatewayCalls[0].validationError, null)
    assert.deepStrictEqual(gatewayCalls[0].payload.sources, businessSources)
    assert.deepStrictEqual(state.outbox.payload_json.sources, businessSources)
    assert.strictEqual(state.outbox.payload_hash, sha256(gatewayCalls[0].rawBody))
    assert.strictEqual(state.outbox.payload_hash, canonicalHash)
    assert.notStrictEqual(state.outbox.payload_hash, seededLegacy.body.legacy_hash)
    assert.strictEqual(gatewayCalls[0].rawBody, canonicalJson(state.outbox.payload_json))
    assert.strictEqual(processingAgain.status, 200)
    assert.strictEqual(processingAgain.body.processados, 0)
    assert.strictEqual(processingAgain.body.falhas, 0)
    assert.strictEqual(stateAgain.outbox.status, 'processado')
    assert.strictEqual(stateAgain.outbox.payload_hash, canonicalHash)
    assert.strictEqual(
      gatewayCalls.length,
      1,
      'repeated processing must not resend or repair again',
    )
    assert.strictEqual(listed.status, 200, `list failed: ${listed.status} ${listed.raw}`)
    assert.deepStrictEqual(listed.body.visoes.conhecimento_aprovado[0].fontes, businessSources)
    assert.deepStrictEqual(
      listed.body.visoes.conhecimento_aprovado[0].entrevista_respostas,
      interviewAnswers,
    )

    const withdrawal = await request(
      `${baseUrl}/backend/v1/nexo/curadoria/casos/${caseId}/transicionar`,
      authenticated,
      {
        acao: 'retirar',
        expected_revision: 2,
        decisao_observacao: 'Retirada autenticada após publicação confirmada.',
      },
    )
    assert.strictEqual(
      withdrawal.status,
      200,
      `withdrawal failed: ${withdrawal.status} ${withdrawal.raw}`,
    )
    const pendingWithdrawalState = await readState(baseUrl)
    assert.strictEqual(pendingWithdrawalState.caso.revisao, 3)
    assert.strictEqual(pendingWithdrawalState.caso.status, 'retirado')
    assert.strictEqual(pendingWithdrawalState.caso.conhecimento_status, 'pendente_retirada')
    assert.strictEqual(pendingWithdrawalState.outbox_count, 2)
    assert.strictEqual(pendingWithdrawalState.outbox.status, 'pendente')
    assert.strictEqual(pendingWithdrawalState.outbox.payload_json.action, 'retirar')

    const withdrawalProcessing = await request(
      `${baseUrl}/backend/v1/nexo/curadoria/outbox/processar`,
      authenticated,
      { limite: 10 },
    )
    assert.strictEqual(withdrawalProcessing.status, 200)
    assert.strictEqual(withdrawalProcessing.body.processados, 1)
    assert.strictEqual(withdrawalProcessing.body.falhas, 0)
    const retiredState = await readState(baseUrl)
    assert.strictEqual(retiredState.caso.conhecimento_status, 'retirado')
    assert.strictEqual(retiredState.outbox_count, 2)
    assert.strictEqual(retiredState.outbox.status, 'processado')
    assert.strictEqual(retiredState.outbox.payload_json.action, 'retirar')
    assert.strictEqual(gatewayCalls.length, 2)
    assert.strictEqual(gatewayCalls[1].validationError, null)
    assert.strictEqual(gatewayCalls[1].payload.action, 'retirar')

    console.log(
      `PocketBase 0.36 Curadoria outbox runtime: PASS publish=ativo withdrawal=retirado gateway_calls=2 sources=${JSON.stringify(businessSources)} payload_hash=${state.outbox.payload_hash} transport_hmac=verified approval_hmac=verified readback=verified`,
    )
  } finally {
    await stopServer(pocketbaseServer)
    await close(gateway)
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
