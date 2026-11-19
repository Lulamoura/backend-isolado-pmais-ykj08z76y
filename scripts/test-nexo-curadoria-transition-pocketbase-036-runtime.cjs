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
  path.join(process.env.TMPDIR || os.tmpdir(), 'nexo-curadoria-transition-pb036-'),
)
const dataDirectory = path.join(workspace, 'data')
const migrationsDirectory = path.join(workspace, 'migrations')
const hooksDirectory = path.join(workspace, 'hooks')
const emptyHooksDirectory = path.join(workspace, 'empty-hooks')
fs.mkdirSync(migrationsDirectory, { recursive: true })
fs.mkdirSync(hooksDirectory, { recursive: true })
fs.mkdirSync(emptyHooksDirectory, { recursive: true })

const email = 'curadoria-transition@example.test'
const password = 'test-password-12345'
const caseId = 'case00000000001'
const futureReviewCaseId = 'case00000000002'
const dueReviewCaseId = 'case00000000003'
const adjustPublicationCaseId = 'case00000000004'
const discardPublicationCaseId = 'case00000000005'
const fixMigration = '202610012350_nexo_curadoria_outbox_zero_attempt.js'
const sourceMigrations = [
  '202610012100_nexo_aprendizado_whatsapp_proveniencia.js',
  '202610012110_nexo_curadoria_decisoes_acl_fail_closed.js',
  '202610012220_nexo_curadoria_comercial_unificada.js',
  '202610012300_nexo_curadoria_review_hardening.js',
  '202610012330_nexo_curadoria_fail_closed.js',
  '202610012340_nexo_curadoria_schema_recovery.js',
  fixMigration,
]

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
    caso.set('fingerprint', 'pb036-transition-case')
    caso.set('revisao', 1)
    caso.set('status', 'aberto_curadoria')
    caso.set('fonte_principal', 'whatsapp')
    caso.set('fontes', ['whatsapp'])
    caso.set('escopo_tipo', 'negocio')
    caso.set('assunto_chave', 'rotina_comercial')
    caso.set('recorrencia_chave', 'pb036-zero-attempt')
    caso.set('titulo', 'Caso PocketBase 0.36')
    caso.set('resumo_factual', 'Caso real para validar aprovação transacional.')
    caso.set('motivo_curadoria', 'Validar persistência inicial da outbox com zero tentativas.')
    caso.set('evidencia_contagem', 1)
    caso.set('casos_independentes', 1)
    caso.set('recorrencia_contagem', 1)
    caso.set('risco_classe', 'baixo')
    caso.set('alcada', 'gestao_comercial')
    caso.set('confianca', 'alta')
    caso.set('human_review_required', true)
    caso.set('automatic_promotion_allowed', false)
    caso.set('first_seen_at', '2026-10-01 12:00:00.000Z')
    caso.set('last_seen_at', '2026-10-01 12:00:00.000Z')
    app.save(caso)

    function seedRejected(id, nextReviewAt) {
      var rejected = new Record(app.findCollectionByNameOrId('com_nexo_curadoria_casos'))
      rejected.id = id
      rejected.set('fingerprint', 'pb036-reopen-' + id)
      rejected.set('revisao', 1)
      rejected.set('status', 'rejeitado')
      rejected.set('fonte_principal', 'nexo_app')
      rejected.set('fontes', ['nexo_app'])
      rejected.set('escopo_tipo', 'equipe')
      rejected.set('assunto_chave', 'rotina_comercial')
      rejected.set('recorrencia_chave', 'pb036-reopen')
      rejected.set('titulo', 'Caso rejeitado para validar reabertura')
      rejected.set('resumo_factual', 'Caso real para validar o vencimento da revisão.')
      rejected.set('motivo_curadoria', 'Reabertura somente após vencimento governado.')
      rejected.set('evidencia_contagem', 3)
      rejected.set('casos_independentes', 3)
      rejected.set('recorrencia_contagem', 3)
      rejected.set('risco_classe', 'baixo')
      rejected.set('alcada', 'gestao_comercial')
      rejected.set('confianca', 'alta')
      rejected.set('human_review_required', true)
      rejected.set('automatic_promotion_allowed', false)
      rejected.set('next_review_at', nextReviewAt)
      rejected.set('first_seen_at', '2026-10-01 12:00:00.000Z')
      rejected.set('last_seen_at', '2026-10-01 12:00:00.000Z')
      app.save(rejected)
    }
    seedRejected('${futureReviewCaseId}', '2030-10-01 12:00:00.000Z')
    seedRejected('${dueReviewCaseId}', '2020-10-01 12:00:00.000Z')

    function seedPendingPublication(id, title) {
      var pending = new Record(app.findCollectionByNameOrId('com_nexo_curadoria_casos'))
      pending.id = id
      pending.set('fingerprint', 'pb036-publication-' + id)
      pending.set('revisao', 5)
      pending.set('status', 'aprovado')
      pending.set('fonte_principal', 'whatsapp')
      pending.set('fontes', ['whatsapp'])
      pending.set('escopo_tipo', 'negocio')
      pending.set('assunto_chave', 'politica_comercial')
      pending.set('recorrencia_chave', 'pb036-publication-governed')
      pending.set('titulo', title)
      pending.set('resumo_factual', 'Caso real para validar decisão de publicação governada.')
      pending.set('motivo_curadoria', 'Matéria sensível submetida à direção.')
      pending.set('regra_candidata', 'Publicar somente após confirmação executiva.')
      pending.set('entrevista_respostas', [
        'Publicar somente após confirmação executiva.',
        'Não aplicar a contratos já assinados.',
        'A direção registra a revisão e o responsável.',
        'A orientação está pronta para decisão humana.',
      ])
      pending.set('entrevista_etapa', 4)
      pending.set('evidencia_contagem', 2)
      pending.set('casos_independentes', 2)
      pending.set('recorrencia_contagem', 2)
      pending.set('risco_classe', 'alto')
      pending.set('alcada', 'direcao')
      pending.set('confianca', 'media')
      pending.set('human_review_required', true)
      pending.set('automatic_promotion_allowed', false)
      pending.set('conhecimento_status', 'pendente_publicacao')
      pending.set('validado_por', 'user00000000001')
      pending.set('first_seen_at', '2026-10-01 12:00:00.000Z')
      pending.set('last_seen_at', '2026-10-01 12:00:00.000Z')
      app.save(pending)
    }
    seedPendingPublication('${adjustPublicationCaseId}', 'Orientação para ajuste antes da publicação')
    seedPendingPublication('${discardPublicationCaseId}', 'Orientação para descarte antes da publicação')
  },
  function (_) {},
)
`

const stateProbeHook = `routerAdd('GET', '/__test/curadoria-transition-state', function (e) {
  var outboxCollection = $app.findCollectionByNameOrId('com_nexo_curadoria_outbox')
  var attempts = outboxCollection.fields.getByName('tentativas')
  var caso = $app.findRecordById('com_nexo_curadoria_casos', '${caseId}')
  var rows = $app.findRecordsByFilter('com_nexo_curadoria_outbox', "id != ''", '-id', 10, 0)
  var outbox = rows.length === 1 ? rows[0] : null
  function governedCase(id) {
    var record = $app.findRecordById('com_nexo_curadoria_casos', id)
    return {
      revisao: record.getInt('revisao'),
      status: record.getString('status'),
      conhecimento_status: record.getString('conhecimento_status'),
      entrevista_respostas: record.get('entrevista_respostas'),
    }
  }
  var governedTransitions = $app.findRecordsByFilter(
    'com_nexo_curadoria_transicoes',
    "caso_id = '${adjustPublicationCaseId}' || caso_id = '${discardPublicationCaseId}'",
    'caso_id',
    10,
    0,
  )
  var governedMetadata = {}
  for (var gti = 0; gti < governedTransitions.length; gti++) {
    governedMetadata[governedTransitions[gti].getString('caso_id')] = {
      motivo: governedTransitions[gti].getString('motivo'),
      metadados: governedTransitions[gti].get('metadados'),
    }
  }
  return e.json(200, {
    attempts_field: {
      type: attempts.type(),
      required: attempts.required,
      min: attempts.min,
    },
    caso: {
      revisao: caso.getInt('revisao'),
      status: caso.getString('status'),
      conhecimento_status: caso.getString('conhecimento_status'),
    },
    transition_count: $app.countRecords('com_nexo_curadoria_transicoes'),
    outbox_count: $app.countRecords('com_nexo_curadoria_outbox'),
    outbox: outbox ? {
      status: outbox.getString('status'),
      tentativas: outbox.getInt('tentativas'),
      caso_revisao: outbox.getInt('caso_revisao'),
    } : null,
    governed_cases: {
      adjust: governedCase('${adjustPublicationCaseId}'),
      discard: governedCase('${discardPublicationCaseId}'),
    },
    governed_metadata: governedMetadata,
  })
})
`

fs.writeFileSync(path.join(migrationsDirectory, '202610012000_setup.js'), setupMigration)
for (const name of sourceMigrations) {
  const source = path.join(root, 'pocketbase', 'migrations', name)
  if (name === fixMigration && !fs.existsSync(source)) continue
  assert(fs.existsSync(source), `migration missing from the real chain: ${name}`)
  fs.copyFileSync(source, path.join(migrationsDirectory, name))
}
fs.writeFileSync(path.join(migrationsDirectory, '202610012400_seed_case.js'), seedCaseMigration)
fs.copyFileSync(
  path.join(root, 'pocketbase', 'hooks', 'com_propostas_operacao.js'),
  path.join(hooksDirectory, 'com_propostas_operacao.pb.js'),
)
fs.writeFileSync(path.join(hooksDirectory, 'zz_curadoria_transition_probe.pb.js'), stateProbeHook)

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
  assert.doesNotMatch(output, /failed to apply migration/i)
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

async function readState(baseUrl, includeGoverned = false) {
  const response = await request(`${baseUrl}/__test/curadoria-transition-state`)
  assert.strictEqual(response.status, 200, `state probe failed: ${response.status} ${response.raw}`)
  if (!includeGoverned) {
    delete response.body.governed_cases
    delete response.body.governed_metadata
  }
  return response.body
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

    const auth = await request(
      `${baseUrl}/api/collections/users/auth-with-password`,
      { method: 'POST' },
      { identity: email, password },
    )
    assert.strictEqual(auth.status, 200, `canonical user authentication failed: ${auth.raw}`)
    assert(auth.body.token, 'canonical user authentication must return a token')
    assert.strictEqual(auth.body.record.id, 'user00000000001')

    const command = {
      acao: 'aprovar',
      expected_revision: 1,
      regra_candidata: 'Registrar orientação comercial validada por curadoria humana.',
      decisao_observacao: 'Aprovação autenticada no PocketBase 0.36.',
    }
    const transitionUrl = `${baseUrl}/backend/v1/nexo/curadoria/casos/${caseId}/transicionar`
    const options = { method: 'POST', headers: { Authorization: auth.body.token } }

    const before = await readState(baseUrl)
    const approval = await request(transitionUrl, options, command)
    const afterApproval = await readState(baseUrl)
    const replay = await request(transitionUrl, options, command)
    const afterReplay = await readState(baseUrl)

    const actual = {
      field: before.attempts_field,
      approval: {
        status: approval.status,
        ok: approval.body && approval.body.ok,
        error: (approval.body && approval.body.error) || null,
      },
      after_approval: afterApproval,
      replay: {
        status: replay.status,
        ok: replay.body && replay.body.ok,
        idempotent_replay: (replay.body && replay.body.idempotent_replay) || false,
      },
      after_replay: afterReplay,
    }

    console.log(`PocketBase 0.36 Curadoria transition observation: ${JSON.stringify(actual)}`)

    assert.deepStrictEqual(actual, {
      field: { type: 'number', required: false, min: 0 },
      approval: { status: 200, ok: true, error: null },
      after_approval: {
        attempts_field: { type: 'number', required: false, min: 0 },
        caso: {
          revisao: 2,
          status: 'aprovado',
          conhecimento_status: 'pendente_publicacao',
        },
        transition_count: 1,
        outbox_count: 1,
        outbox: { status: 'aguardando_confirmacao', tentativas: 0, caso_revisao: 2 },
      },
      replay: { status: 200, ok: true, idempotent_replay: true },
      after_replay: {
        attempts_field: { type: 'number', required: false, min: 0 },
        caso: {
          revisao: 2,
          status: 'aprovado',
          conhecimento_status: 'pendente_publicacao',
        },
        transition_count: 1,
        outbox_count: 1,
        outbox: { status: 'aguardando_confirmacao', tentativas: 0, caso_revisao: 2 },
      },
    })

    const publishCommand = {
      acao: 'publicar',
      expected_revision: 2,
      regra_candidata: command.regra_candidata,
      decisao_observacao: 'Publicação humana explicitamente confirmada.',
      confirmacao_publicacao: true,
    }
    const explicitPublication = await request(transitionUrl, options, publishCommand)
    assert.strictEqual(explicitPublication.status, 200)
    assert.strictEqual(explicitPublication.body.caso.revisao, 3)
    assert.strictEqual(explicitPublication.body.caso.status, 'aprovado')
    assert.strictEqual(explicitPublication.body.caso.conhecimento_status, 'pendente_publicacao')
    assert(explicitPublication.body.outbox_id)
    const explicitPublicationReplay = await request(transitionUrl, options, publishCommand)
    assert.strictEqual(explicitPublicationReplay.status, 200)
    assert.strictEqual(explicitPublicationReplay.body.idempotent_replay, true)
    assert.strictEqual(explicitPublicationReplay.body.outbox_id, explicitPublication.body.outbox_id)
    const divergentPublicationReplay = await request(transitionUrl, options, {
      ...publishCommand,
      decisao_observacao: 'Comando divergente não pode reutilizar a publicação.',
    })
    assert.strictEqual(divergentPublicationReplay.status, 409)
    assert.strictEqual(divergentPublicationReplay.body.error, 'REPLAY_DIVERGENTE')

    const adjustObservation = 'Aprovação anterior invalidada para ajuste da orientação.'
    const adjustPublication = await request(
      `${baseUrl}/backend/v1/nexo/curadoria/casos/${adjustPublicationCaseId}/transicionar`,
      options,
      {
        acao: 'ajustar_publicacao',
        expected_revision: 5,
        regra_candidata: 'Publicar somente após confirmação executiva.',
        decisao_observacao: adjustObservation,
      },
    )
    assert.strictEqual(adjustPublication.status, 200)
    assert.strictEqual(adjustPublication.body.caso.revisao, 6)
    assert.strictEqual(adjustPublication.body.caso.status, 'em_entrevista')
    assert.strictEqual(adjustPublication.body.caso.conhecimento_status, 'nao_publicado')
    assert.strictEqual(adjustPublication.body.caso.entrevista_respostas.length, 4)

    const discardObservation = 'A orientação não deve integrar o conhecimento operacional.'
    const discardPublication = await request(
      `${baseUrl}/backend/v1/nexo/curadoria/casos/${discardPublicationCaseId}/transicionar`,
      options,
      {
        acao: 'descartar_publicacao',
        expected_revision: 5,
        regra_candidata: 'Publicar somente após confirmação executiva.',
        decisao_observacao: discardObservation,
      },
    )
    assert.strictEqual(discardPublication.status, 200)
    assert.strictEqual(discardPublication.body.caso.revisao, 6)
    assert.strictEqual(discardPublication.body.caso.status, 'descartado')
    assert.strictEqual(discardPublication.body.caso.conhecimento_status, 'nao_publicado')

    const governedState = await readState(baseUrl, true)
    assert.deepStrictEqual(governedState.governed_cases.adjust.entrevista_respostas, [
      'Publicar somente após confirmação executiva.',
      'Não aplicar a contratos já assinados.',
      'A direção registra a revisão e o responsável.',
      'A orientação está pronta para decisão humana.',
    ])
    assert.strictEqual(
      governedState.governed_metadata[adjustPublicationCaseId].metadados.acao,
      'ajustar_publicacao',
    )
    assert.strictEqual(
      governedState.governed_metadata[adjustPublicationCaseId].metadados.revisao_preservada.revisao,
      5,
    )
    assert.strictEqual(
      governedState.governed_metadata[adjustPublicationCaseId].metadados.revisao_preservada
        .entrevista_respostas.length,
      4,
    )
    assert.strictEqual(
      governedState.governed_metadata[discardPublicationCaseId].metadados.acao,
      'descartar_publicacao',
    )
    assert.strictEqual(
      governedState.governed_metadata[discardPublicationCaseId].motivo,
      discardObservation,
    )

    const reopenCommand = {
      acao: 'reabrir',
      expected_revision: 1,
      decisao_observacao: 'Reabertura testada pelo vencimento governado.',
    }
    const futureReopen = await request(
      `${baseUrl}/backend/v1/nexo/curadoria/casos/${futureReviewCaseId}/transicionar`,
      options,
      reopenCommand,
    )
    assert.strictEqual(futureReopen.status, 409)
    assert.strictEqual(futureReopen.body.error, 'REABERTURA_NAO_ELEGIVEL')

    const dueReopen = await request(
      `${baseUrl}/backend/v1/nexo/curadoria/casos/${dueReviewCaseId}/transicionar`,
      options,
      reopenCommand,
    )
    assert.strictEqual(dueReopen.status, 200)
    assert.strictEqual(dueReopen.body.caso.status, 'aberto_curadoria')
    assert.strictEqual(dueReopen.body.caso.revisao, 2)
    assert.strictEqual(dueReopen.body.caso.reabertura_elegivel, false)

    console.log(
      'PocketBase 0.36 Curadoria transition runtime: PASS required=false approval=200 revision=2 status=aprovado knowledge=pendente_publicacao transitions=1 outbox=1 attempts=0 replay=true',
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
