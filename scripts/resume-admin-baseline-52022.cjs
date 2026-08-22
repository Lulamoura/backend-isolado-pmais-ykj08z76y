const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

const PROJECT_ID = 52022
const PROJECT_UUID = '9bd690dc-fec2-4b18-88f1-11f6cc1329a5'
const EXPECTED_FINGERPRINT = '4552a681f36569042b2d4c0c7301e085f8a0a36f6d9e439546e846e3ae7b6a55'
const root = path.resolve(__dirname, '..')
const reportPath = path.resolve(root, '../../output/aplicacao-comercial-pmais/t62-r2-admin-baseline-dry-run.json')
const journalPath = path.resolve(root, '../../output/aplicacao-comercial-pmais/t62-r2-admin-baseline-resume-52022.json')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
function getJson(url) {
  return new Promise((resolve, reject) =>
    http.get(url, (response) => {
      let data = ''
      response.on('data', (chunk) => (data += chunk))
      response.on('end', () => resolve(JSON.parse(data)))
    }).on('error', reject),
  )
}

async function browserTokens() {
  const pages = await getJson('http://127.0.0.1:19222/json/list')
  const page = pages.find((item) => item.url?.includes(`/builder/${PROJECT_UUID}`))
  if (!page) throw new Error('candidate browser target not found')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    const request = pending.get(message.id)
    if (!request) return
    pending.delete(message.id)
    message.error ? request.reject(new Error('CDP error')) : request.resolve(message.result)
  }
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  const send = (method, params = {}) => {
    const requestId = ++id
    ws.send(JSON.stringify({ id: requestId, method, params }))
    return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }))
  }
  const result = await send('Runtime.evaluate', {
    expression: `(() => { const s=JSON.parse(localStorage.getItem('skip-auth')||'{}')?.state?.session; return s ? {a:s.access_token,r:s.refresh_token}:null })()`,
    returnByValue: true,
  })
  ws.close()
  const value = result.result.value
  if (!value?.a || !value?.r) throw new Error('browser session unavailable')
  return value
}

async function main() {
  if (process.argv[2] !== 'RESUME-BASELINE-52022') throw new Error('explicit confirmation required')
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
  if (report.operationsFingerprint !== EXPECTED_FINGERPRINT) throw new Error('fingerprint mismatch')
  const base = `https://api.goskip.dev/v1/projects/${PROJECT_ID}/integrations/skip-cloud`
  let session = await browserTokens()
  let calls = 0
  async function request(relative, options = {}) {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      if (calls > 0 && calls % 20 === 0) session = await browserTokens()
      calls += 1
      try {
        const response = await fetch(base + relative, {
          ...options,
          headers: {
            'content-type': 'application/json',
            'x-access-token': session.a,
            'x-refresh-token': session.r,
          },
          signal: AbortSignal.timeout(25000),
        })
        const text = await response.text()
        let body = null
        try { body = text ? JSON.parse(text) : null } catch { body = { raw: text.slice(0, 300) } }
        if (response.ok && !body?.error) return body
        if (response.status !== 404 && response.status < 500) {
          throw new Error(`${options.method || 'GET'} ${relative} failed ${response.status}: ${body?.error || body?.raw || 'unknown'}`)
        }
      } catch (error) {
        if (attempt === 5) throw error
      }
      await sleep(2500 * attempt)
      session = await browserTokens()
    }
    throw new Error(`${options.method || 'GET'} ${relative} unavailable`)
  }
  const collections = async () => (await request('/collections')).collections
  const journal = {
    format: 'pmais-admin-baseline-resume/v1',
    projectId: PROJECT_ID,
    sourceFingerprint: EXPECTED_FINGERPRINT,
    startedAt: new Date().toISOString(),
    status: 'running',
    checkpoints: [],
  }
  const save = () => {
    fs.mkdirSync(path.dirname(journalPath), { recursive: true, mode: 0o700 })
    fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2) + '\n', { mode: 0o600 })
  }
  save()

  const skeletons = report.operations.filter((item) => item.type === 'create_collection_skeleton')
  for (const [index, operation] of skeletons.entries()) {
    let current = await collections()
    if (!current.some((item) => item.name === operation.collection)) {
      try {
        await request('/collections', { method: 'POST', body: JSON.stringify(operation.payload) })
      } catch (error) {
        current = await collections()
        if (!current.some((item) => item.name === operation.collection)) throw error
      }
    }
    await sleep(1200)
    current = await collections()
    if (!current.some((item) => item.name === operation.collection)) throw new Error(`skeleton missing: ${operation.collection}`)
    if ((index + 1) % 6 === 0 || index + 1 === skeletons.length) {
      journal.checkpoints.push({ phase: 'skeletons', completed: index + 1, at: new Date().toISOString() })
      save()
      console.log(`skeletons ${index + 1}/29`)
    }
  }

  const definitions = report.operations.filter((item) => item.type === 'apply_collection_definition')
  for (const [index, operation] of definitions.entries()) {
    const current = await collections()
    const collection = current.find((item) => item.name === operation.collection)
    if (!collection) throw new Error(`definition target missing: ${operation.collection}`)
    await request(`/collections/${encodeURIComponent(collection.id)}`, {
      method: 'PATCH', body: JSON.stringify(operation.payload),
    })
    await sleep(1200)
    const fresh = (await collections()).find((item) => item.name === operation.collection)
    if (!fresh || fresh.fields.length !== operation.payload.fields.length) {
      throw new Error(`definition verification failed: ${operation.collection}`)
    }
    if ((index + 1) % 5 === 0 || index + 1 === definitions.length) {
      journal.checkpoints.push({ phase: 'definitions', completed: index + 1, at: new Date().toISOString() })
      save()
      console.log(`definitions ${index + 1}/29`)
    }
  }

  const usersOperation = report.operations.find((item) => item.type === 'update_collection' && item.collection === 'users')
  let current = await collections()
  const users = current.find((item) => item.name === 'users')
  const commercialNames = ['perfil_id', 'equipe_id', 'ativo_comercial']
  const extensionFields = usersOperation.payload.fields.filter((field) => commercialNames.includes(field.name))
  const present = new Set(users.fields.map((field) => field.name))
  if (!commercialNames.every((name) => present.has(name))) {
    const payload = {
      ...users,
      fields: [...users.fields.filter((field) => !commercialNames.includes(field.name)), ...extensionFields],
      listRule: usersOperation.payload.listRule,
      viewRule: usersOperation.payload.viewRule,
      createRule: usersOperation.payload.createRule,
      updateRule: usersOperation.payload.updateRule,
      deleteRule: usersOperation.payload.deleteRule,
    }
    await request(`/collections/${encodeURIComponent(users.id)}`, { method: 'PATCH', body: JSON.stringify(payload) })
  }
  current = await collections()
  const freshUsers = current.find((item) => item.name === 'users')
  if (!commercialNames.every((name) => freshUsers.fields.some((field) => field.name === name))) {
    throw new Error('users extension verification failed')
  }
  journal.checkpoints.push({ phase: 'users', completed: 1, at: new Date().toISOString() })
  save()
  console.log('users extension 1/1')

  if (current.length !== 30) throw new Error(`schema count mismatch: ${current.length}`)
  const history = current.find((item) => item.name === 'com_qualificacao_historico')
  if (!history?.listRule?.includes("slug = 'superadministrador'") || !history?.viewRule?.includes("slug = 'superadministrador'")) {
    throw new Error('qualification history rules mismatch')
  }

  const recordOperations = report.operations.filter((item) => item.type === 'create_record')
  const knownIds = new Map()
  for (const collection of current) {
    const response = await request(`/collections/${encodeURIComponent(collection.id)}/records?page=1&perPage=500`)
    knownIds.set(collection.name, new Set(response.items.map((item) => item.id)))
  }
  for (const [index, operation] of recordOperations.entries()) {
    const collection = current.find((item) => item.name === operation.collection)
    const ids = knownIds.get(operation.collection)
    if (!ids.has(operation.payload.id)) {
      try {
        await request(`/collections/${encodeURIComponent(collection.id)}/records`, {
          method: 'POST', body: JSON.stringify(operation.payload),
        })
      } catch (error) {
        const response = await request(`/collections/${encodeURIComponent(collection.id)}/records?page=1&perPage=500`)
        if (!response.items.some((item) => item.id === operation.payload.id)) throw error
      }
      ids.add(operation.payload.id)
    }
    await sleep(350)
    if ((index + 1) % 20 === 0 || index + 1 === recordOperations.length) {
      journal.checkpoints.push({ phase: 'records', completed: index + 1, at: new Date().toISOString() })
      save()
      console.log(`records ${index + 1}/167`)
    }
  }

  current = await collections()
  const counts = {}
  let total = 0
  for (const collection of current) {
    const response = await request(`/collections/${encodeURIComponent(collection.id)}/records?page=1&perPage=1`)
    counts[collection.name] = response.totalItems
    total += response.totalItems
  }
  for (const [name, expected] of Object.entries(report.summary.seedCounts)) {
    if (counts[name] !== expected) throw new Error(`count mismatch ${name}: ${counts[name]} != ${expected}`)
  }
  if (counts.users !== 0 || total !== 167) throw new Error(`final record totals mismatch: users=${counts.users}, total=${total}`)
  const migrations = (await request('/migrations')).migrations
  journal.status = 'complete'
  journal.finishedAt = new Date().toISOString()
  journal.summary = { collections: current.length, migrations: migrations.length, users: counts.users, totalRecords: total, counts }
  save()
  console.log(JSON.stringify(journal.summary))
}

main().catch((error) => { console.error(error.message); process.exit(1) })
