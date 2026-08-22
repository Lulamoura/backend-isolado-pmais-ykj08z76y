const http = require('node:http')

const projectId = 52022
const projectUuid = '9bd690dc-fec2-4b18-88f1-11f6cc1329a5'

function getJson(url) {
  return new Promise((resolve, reject) =>
    http.get(url, (response) => {
      let data = ''
      response.on('data', (chunk) => (data += chunk))
      response.on('end', () => resolve(JSON.parse(data)))
    }).on('error', reject),
  )
}

async function tokens() {
  const pages = await getJson('http://127.0.0.1:19222/json/list')
  const page = pages.find((item) => item.url?.includes(`/builder/${projectUuid}`))
  if (!page) throw new Error('candidate target not found')
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
  return result.result.value
}

async function main() {
  const session = await tokens()
  if (!session?.a || !session?.r) throw new Error('session unavailable')
  const headers = { 'x-access-token': session.a, 'x-refresh-token': session.r }
  const base = `https://api.goskip.dev/v1/projects/${projectId}/integrations/skip-cloud`
  const request = async (path) => {
    const response = await fetch(base + path, { headers, signal: AbortSignal.timeout(20000) })
    const body = await response.json()
    if (!response.ok || body.error) throw new Error(`${path} failed ${response.status}: ${body.error || 'unknown'}`)
    return body
  }
  const collections = (await request('/collections')).collections
  const migrations = (await request('/migrations')).migrations
  const integration = process.argv.includes('--integration') ? await request('') : undefined
  const counts = {}
  for (const collection of collections) {
    counts[collection.name] = (await request(`/collections/${encodeURIComponent(collection.id)}/records?page=1&perPage=1`)).totalItems
  }
  const usersCollection = collections.find((item) => item.name === 'users')
  const userItems = process.argv.includes('--users')
    ? (await request(`/collections/${encodeURIComponent(usersCollection.id)}/records?page=1&perPage=100`)).items.map((item) => ({
        id: item.id,
        name: item.name,
        ativo_comercial: item.ativo_comercial,
        verified: item.verified,
        perfil_id: item.perfil_id,
        equipe_id: item.equipe_id,
      }))
    : undefined
  console.log(JSON.stringify({ names: collections.map((item) => item.name), migrations: migrations.length, counts, users: userItems, integration }, null, 2))
}

main().catch((error) => { console.error(error.message); process.exit(1) })
