const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

const PROJECT_ID = 52060
const PROJECT_UUID = '4cda40fc-53e0-40bf-baf1-5a56dbf12889'
const EXPECTED_FINGERPRINT = 'fafe313bd74ccb86f09dd7b77f3ba751f6112294c4608a8b37c3eef67667e0a5'
const API_BASE = `https://api.goskip.dev/v1/projects/${PROJECT_ID}/integrations/skip-cloud`
const root = path.resolve(__dirname, '..')
const reportPath = path.resolve(
  root,
  '../../output/aplicacao-comercial-pmais/t62-r2-admin-baseline-dry-run.json',
)
const journalPath = path.resolve(
  root,
  '../../output/aplicacao-comercial-pmais/t62-r2-admin-baseline-apply-journal-52060.json',
)

function getJson(url) {
  return new Promise((resolve, reject) =>
    http
      .get(url, (response) => {
        let data = ''
        response.on('data', (chunk) => (data += chunk))
        response.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (error) {
            reject(error)
          }
        })
      })
      .on('error', reject),
  )
}

async function browserTokens() {
  const pages = await getJson('http://127.0.0.1:19222/json/list')
  const page = pages.find((item) => item.url?.includes(`/builder/${PROJECT_UUID}`))
  if (!page) throw new Error('SKIP candidate target not found')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (!message.id || !pending.has(message.id)) return
    const request = pending.get(message.id)
    pending.delete(message.id)
    message.error
      ? request.reject(new Error(JSON.stringify(message.error)))
      : request.resolve(message.result)
  }
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  const send = (method, params = {}) => {
    const requestId = ++id
    ws.send(JSON.stringify({ id: requestId, method, params }))
    return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }))
  }
  const result = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const session = JSON.parse(localStorage.getItem('skip-auth') || '{}')?.state?.session
      return session ? { access: session.access_token, refresh: session.refresh_token } : null
    })()`,
  })
  ws.close()
  const tokens = result.result.value
  if (!tokens?.access || !tokens?.refresh) throw new Error('SKIP session token unavailable')
  return tokens
}

function writeJournal(journal) {
  fs.mkdirSync(path.dirname(journalPath), { recursive: true, mode: 0o700 })
  fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2) + '\n', { mode: 0o600 })
}

async function main() {
  if (process.argv[2] !== 'APPLY-CANDIDATE-BASELINE-52060') {
    throw new Error('explicit candidate apply confirmation is required')
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
  if (report.mode !== 'dry-run') throw new Error('invalid report mode')
  if (report.operationsFingerprint !== EXPECTED_FINGERPRINT) {
    throw new Error('dry-run fingerprint mismatch')
  }
  if (
    report.summary.createCollectionSkeletons !== 29 ||
    report.summary.applyCollectionDefinitions !== 29 ||
    report.summary.updateCollections !== 1 ||
    report.summary.createRecords !== 168 ||
    report.summary.expectedSchemaLedgerEvents !== 59
  ) {
    throw new Error('dry-run operation counts mismatch')
  }

  const tokens = await browserTokens()
  const headers = {
    'content-type': 'application/json',
    'x-access-token': tokens.access,
    'x-refresh-token': tokens.refresh,
  }
  async function request(relative, options = {}) {
    const response = await fetch(API_BASE + relative, { ...options, headers })
    const text = await response.text()
    let body = null
    if (text) {
      try {
        body = JSON.parse(text)
      } catch (_) {
        body = { raw: text.slice(0, 500) }
      }
    }
    if (!response.ok || body?.error) {
      throw new Error(
        `${options.method || 'GET'} ${relative} failed (${response.status}): ${body?.error || body?.raw || 'unknown'}`,
      )
    }
    return body
  }

  const initialCollections = (await request('/collections')).collections
  const initialMigrations = (await request('/migrations')).migrations
  if (
    initialCollections.length !== 1 ||
    initialCollections[0].name !== 'users' ||
    initialMigrations.length !== 0
  ) {
    throw new Error('pre-state mismatch; refusing to write')
  }
  const originalUsers = initialCollections[0]
  const initialUsers = await request(
    `/collections/${encodeURIComponent(originalUsers.id)}/records?page=1&perPage=1`,
  )
  if (initialUsers.totalItems !== 0) {
    throw new Error('candidate users collection is not empty; refusing to write')
  }
  const createdCollections = []
  let usersUpdated = false
  const journal = {
    format: 'pmais-admin-baseline-apply/v2',
    startedAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    backend: 'backend-limpo-pmais-r2-43211',
    sourceFingerprint: report.operationsFingerprint,
    preState: { collections: 1, migrations: 0, users: 0 },
    status: 'running',
    phases: [],
  }
  writeJournal(journal)

  async function rollback(reason) {
    const failures = []
    if (usersUpdated) {
      try {
        await request(`/collections/${encodeURIComponent(originalUsers.id)}`, {
          method: 'PATCH',
          body: JSON.stringify(originalUsers),
        })
      } catch (error) {
        failures.push(`restore users: ${error.message}`)
      }
    }
    for (const collection of [...createdCollections].reverse()) {
      try {
        await request(`/collections/${encodeURIComponent(collection.name)}`, {
          method: 'DELETE',
        })
      } catch (error) {
        failures.push(`delete ${collection.name}: ${error.message}`)
      }
    }
    journal.status = failures.length ? 'rollback_failed' : 'rolled_back'
    journal.failure = reason
    journal.rollbackFailures = failures
    journal.finishedAt = new Date().toISOString()
    writeJournal(journal)
    if (failures.length) throw new Error(`${reason}; rollback failures: ${failures.join('; ')}`)
    throw new Error(`${reason}; rollback completed`)
  }

  try {
    const createOperations = report.operations.filter(
      (operation) => operation.type === 'create_collection_skeleton',
    )
    for (const [index, operation] of createOperations.entries()) {
      const body = await request('/collections', {
        method: 'POST',
        body: JSON.stringify(operation.payload),
      })
      const collection = body.collection
      if (collection?.id !== operation.payload.id || collection?.name !== operation.payload.name) {
        await rollback(`collection response mismatch at ${operation.collection}`)
      }
      createdCollections.push({ id: collection.id, name: collection.name })
      journal.phases.push({
        type: 'create_collection',
        sequence: index + 1,
        name: collection.name,
        id: collection.id,
        status: 'ok',
      })
      writeJournal(journal)
      console.log(`skeleton ${index + 1}/29 ${collection.name}`)
    }

    const definitionOperations = report.operations.filter(
      (operation) => operation.type === 'apply_collection_definition',
    )
    for (const [index, operation] of definitionOperations.entries()) {
      const collection = createdCollections.find(
        (candidate) => candidate.name === operation.collection,
      )
      if (!collection) await rollback(`definition target missing: ${operation.collection}`)
      const body = await request(`/collections/${encodeURIComponent(collection.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(operation.payload),
      })
      if (body.collection?.name !== operation.collection) {
        await rollback(`definition response mismatch at ${operation.collection}`)
      }
      journal.phases.push({
        type: 'apply_collection_definition',
        sequence: index + 1,
        name: operation.collection,
        status: 'ok',
      })
      writeJournal(journal)
      console.log(`definition ${index + 1}/29 ${operation.collection}`)
    }

    const usersOperation = report.operations.find(
      (operation) => operation.type === 'update_collection' && operation.collection === 'users',
    )
    const extensionFields = usersOperation.payload.fields.filter((field) =>
      ['perfil_id', 'equipe_id', 'ativo_comercial'].includes(field.name),
    )
    const existingFieldNames = new Set(originalUsers.fields.map((field) => field.name))
    if (extensionFields.some((field) => existingFieldNames.has(field.name))) {
      await rollback('users already contains a baseline extension field')
    }
    const usersPayload = {
      ...originalUsers,
      fields: [...originalUsers.fields, ...extensionFields],
      listRule: usersOperation.payload.listRule,
      viewRule: usersOperation.payload.viewRule,
      createRule: usersOperation.payload.createRule,
      updateRule: usersOperation.payload.updateRule,
      deleteRule: usersOperation.payload.deleteRule,
    }
    const usersBody = await request(`/collections/${encodeURIComponent(originalUsers.id)}`, {
      method: 'PATCH',
      body: JSON.stringify(usersPayload),
    })
    usersUpdated = true
    const returnedUserFields = new Set(usersBody.collection.fields.map((field) => field.name))
    if (extensionFields.some((field) => !returnedUserFields.has(field.name))) {
      await rollback('users extension verification failed')
    }
    journal.phases.push({ type: 'update_collection', name: 'users', status: 'ok' })
    writeJournal(journal)
    console.log('users extended 1/1')

    const schemaCollections = (await request('/collections')).collections
    if (schemaCollections.length !== 30) await rollback('schema collection count is not 30')
    const schemaNames = new Set(schemaCollections.map((collection) => collection.name))
    for (const operation of createOperations) {
      if (!schemaNames.has(operation.collection)) {
        await rollback(`schema is missing ${operation.collection}`)
      }
    }
    const finalUsersSchema = schemaCollections.find((collection) => collection.name === 'users')
    const finalUserFields = new Set(finalUsersSchema.fields.map((field) => field.name))
    if (extensionFields.some((field) => !finalUserFields.has(field.name))) {
      await rollback('fresh users schema verification failed')
    }
    const historyCollection = schemaCollections.find(
      (collection) => collection.name === 'com_qualificacao_historico',
    )
    for (const ruleName of ['listRule', 'viewRule']) {
      if (!historyCollection?.[ruleName]?.includes("slug = 'superadministrador'")) {
        await rollback(`qualification history ${ruleName} is not restricted`)
      }
    }
    journal.phases.push({ type: 'schema_checkpoint', collections: 30, status: 'ok' })
    writeJournal(journal)
    console.log('schema checkpoint 30/30')

    const recordOperations = report.operations.filter(
      (operation) => operation.type === 'create_record',
    )
    const expectedByCollection = report.summary.seedCounts
    const insertedByCollection = {}
    for (const [index, operation] of recordOperations.entries()) {
      const collection = schemaCollections.find(
        (candidate) => candidate.name === operation.collection,
      )
      if (!collection) await rollback(`record target missing: ${operation.collection}`)
      const body = await request(`/collections/${encodeURIComponent(collection.id)}/records`, {
        method: 'POST',
        body: JSON.stringify(operation.payload),
      })
      if (body.record?.id !== operation.payload.id) {
        await rollback(`record response mismatch at ${operation.collection}`)
      }
      insertedByCollection[operation.collection] =
        (insertedByCollection[operation.collection] || 0) + 1
      if ((index + 1) % 20 === 0 || index + 1 === recordOperations.length) {
        console.log(`records ${index + 1}/168`)
      }
    }

    let structuralRecords = 0
    let transactionalRecords = 0
    for (const collection of schemaCollections) {
      const result = await request(
        `/collections/${encodeURIComponent(collection.id)}/records?page=1&perPage=1`,
      )
      const expected = expectedByCollection[collection.name] || 0
      if (result.totalItems !== expected) {
        await rollback(
          `record count mismatch in ${collection.name}: ${result.totalItems} != ${expected}`,
        )
      }
      if (expected > 0) structuralRecords += result.totalItems
      else transactionalRecords += result.totalItems
    }
    if (structuralRecords !== 168) await rollback('structural record total is not 168')
    if (transactionalRecords !== 0) await rollback('transactional record total is not zero')
    const finalMigrations = (await request('/migrations')).migrations
    if (finalMigrations.length !== report.summary.expectedSchemaLedgerEvents) {
      await rollback(
        `schema ledger count mismatch: ${finalMigrations.length} != ${report.summary.expectedSchemaLedgerEvents}`,
      )
    }

    journal.status = 'complete'
    journal.summary = {
      collections: 30,
      migrations: finalMigrations.length,
      users: 0,
      structuralRecords: 168,
      transactionalRecords: 0,
      seedCounts: expectedByCollection,
    }
    journal.finishedAt = new Date().toISOString()
    writeJournal(journal)
    console.log(JSON.stringify(journal.summary))
  } catch (error) {
    if (journal.status === 'rolled_back' || journal.status === 'rollback_failed') throw error
    await rollback(error.message)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
