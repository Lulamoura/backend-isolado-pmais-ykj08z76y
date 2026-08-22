const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

const candidate = { id: 52022, uuid: '9bd690dc-fec2-4b18-88f1-11f6cc1329a5' }
const original = { id: 48703 }
const report = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../output/aplicacao-comercial-pmais/t62-r2-admin-baseline-dry-run.json'), 'utf8'))

function getJson(url) {
  return new Promise((resolve, reject) => http.get(url, (response) => {
    let data = ''
    response.on('data', (chunk) => (data += chunk))
    response.on('end', () => resolve(JSON.parse(data)))
  }).on('error', reject))
}
async function tokens() {
  const pages = await getJson('http://127.0.0.1:19222/json/list')
  const page = pages.find((item) => item.url?.includes(`/builder/${candidate.uuid}`))
  if (!page) throw new Error('candidate browser target not found')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    const request = pending.get(message.id)
    if (!request) return
    pending.delete(message.id)
    request.resolve(message.result)
  }
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  const requestId = ++id
  ws.send(JSON.stringify({ id: requestId, method: 'Runtime.evaluate', params: {
    expression: `(() => { const s=JSON.parse(localStorage.getItem('skip-auth')||'{}')?.state?.session; return {a:s.access_token,r:s.refresh_token} })()`,
    returnByValue: true,
  }}))
  const result = await new Promise((resolve) => pending.set(requestId, { resolve }))
  ws.close()
  return result.result.value
}
const canonicalFields = (fields) => fields.map((field) => ({
  name: field.name,
  type: field.type,
  required: Boolean(field.required),
  collectionId: field.collectionId || null,
})).sort((a, b) => a.name.localeCompare(b.name))

async function main() {
  const session = await tokens()
  const headers = { 'x-access-token': session.a, 'x-refresh-token': session.r }
  const read = async (projectId, relative) => {
    const base = `https://api.goskip.dev/v1/projects/${projectId}/integrations/skip-cloud`
    const response = await fetch(base + relative, { headers, signal: AbortSignal.timeout(25000) })
    const body = await response.json()
    if (!response.ok || body.error) throw new Error(`${projectId}${relative}: ${response.status} ${body.error || 'unknown'}`)
    return body
  }
  const collections = (await read(candidate.id, '/collections')).collections
  const definitions = report.operations.filter((item) => item.type === 'apply_collection_definition')
  const mismatches = []
  for (const operation of definitions) {
    const live = collections.find((item) => item.name === operation.collection)
    if (!live) { mismatches.push(`${operation.collection}:missing`); continue }
    if (JSON.stringify(canonicalFields(live.fields)) !== JSON.stringify(canonicalFields(operation.payload.fields))) {
      mismatches.push(`${operation.collection}:fields`)
    }
    for (const key of ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']) {
      if ((live[key] ?? null) !== (operation.payload[key] ?? null)) mismatches.push(`${operation.collection}:${key}`)
    }
  }
  const users = collections.find((item) => item.name === 'users')
  const userFields = new Set(users.fields.map((field) => field.name))
  for (const name of ['perfil_id', 'equipe_id', 'ativo_comercial']) {
    if (!userFields.has(name)) mismatches.push(`users:${name}`)
  }
  const counts = {}
  for (const collection of collections) {
    counts[collection.name] = (await read(candidate.id, `/collections/${encodeURIComponent(collection.id)}/records?page=1&perPage=1`)).totalItems
  }
  const expected = { ...Object.fromEntries(collections.map((item) => [item.name, 0])), ...report.summary.seedCounts }
  for (const [name, count] of Object.entries(expected)) if (counts[name] !== count) mismatches.push(`${name}:count=${counts[name]} expected=${count}`)
  const candidateMigrations = (await read(candidate.id, '/migrations')).migrations.length
  const originalCollections = (await read(original.id, '/collections')).collections.length
  const originalMigrations = (await read(original.id, '/migrations')).migrations.length
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  const result = {
    passed: mismatches.length === 0 && collections.length === 30 && total === 167,
    candidate: { collections: collections.length, migrations: candidateMigrations, users: counts.users, totalRecords: total, counts },
    original: { collections: originalCollections, migrations: originalMigrations },
    source: { fingerprint: report.operationsFingerprint, migrationSha256: report.source.migrationSha256 },
    mismatches,
  }
  console.log(JSON.stringify(result, null, 2))
  if (!result.passed) process.exitCode = 1
}
main().catch((error) => { console.error(error.message); process.exit(1) })
