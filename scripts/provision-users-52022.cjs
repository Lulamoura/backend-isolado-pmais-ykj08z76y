const http = require('node:http')

const PROJECT_ID = 52022
const PROJECT_UUID = '9bd690dc-fec2-4b18-88f1-11f6cc1329a5'
const TEAM_ID = 'e7pyx0wgf4n356u'
const START = '2026-08-22 00:00:00.000Z'

const users = [
  { key: 'CRISTIANE', id: '2l6xnywtiwm53xq', name: 'Cristiane Maria da Silva', profile: '7aqvkb872ktbhq0', scope: 'proprios', binding: '4q3v11fafgj11ju', external: ['hr6c0dvp0c5gy4f', 'Vendedor 1'] },
  { key: 'RAQUEL', id: 'g6pxypm3844lq68', name: 'Raquel Trindade Bezerra da Silva', profile: '7aqvkb872ktbhq0', scope: 'proprios', binding: 'nqoh2i5sfnjlxpf', external: ['76efz4yy9b56qgh', 'Vendedor 2'] },
  { key: 'VIVIANE', id: 'd1spnjkg3g7l6fd', name: 'Viviane Marculino da Silva', profile: '7aqvkb872ktbhq0', scope: 'proprios', binding: '36eu0d2cch4e11w', external: ['t0xwjt84qynofn5', 'Vendedor 4'] },
  { key: 'RITA', id: 'ruf9l3865ak3t51', name: 'Rita de Cássia Gomes Moura', profile: 'lde2qvbk0935vuw', scope: 'equipe', binding: 'qr4l8teofn5y7v0', external: ['hk8qc7jj176qces', 'Vendedor 5'] },
  { key: 'SHIRLEIDE', id: 'pmdghnoqc5x3rnn', name: 'Shirleide Andrade do Nascimento', profile: 't782xyk2z5eyu9h', scope: 'proprios', binding: 'o8mmi6aw9e7w5mb', external: ['cw3gb8faru5kgdn', 'Vendedor 6'] },
  { key: 'LULA', id: 'lulamoura52022x', name: 'Luiz Antônio Moura', profile: '5s3wdrmxvcu6btl', scope: 'todos', binding: 'lulabinding522x', external: null },
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
function getJson(url) {
  return new Promise((resolve, reject) => http.get(url, (response) => {
    let data = ''
    response.on('data', (chunk) => (data += chunk))
    response.on('end', () => resolve(JSON.parse(data)))
  }).on('error', reject))
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

async function main() {
  if (process.argv[2] !== 'PROVISION-USERS-52022') throw new Error('explicit confirmation required')
  for (const user of users) {
    user.email = process.env[`PMAIS_${user.key}_USERNAME`]
    user.password = process.env[`PMAIS_${user.key}_PASSWORD`]
    if (!user.email || !user.password || user.password.length < 20) throw new Error(`credential unavailable: ${user.key}`)
  }
  let session = await browserTokens()
  const base = `https://api.goskip.dev/v1/projects/${PROJECT_ID}/integrations/skip-cloud`
  let calls = 0
  async function request(relative, options = {}) {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      if (calls && calls % 20 === 0) session = await browserTokens()
      calls += 1
      try {
        const response = await fetch(base + relative, {
          ...options,
          headers: { 'content-type': 'application/json', 'x-access-token': session.a, 'x-refresh-token': session.r },
          signal: AbortSignal.timeout(25000),
        })
        const text = await response.text()
        let body = null
        try { body = text ? JSON.parse(text) : null } catch { body = { raw: text.slice(0, 200) } }
        if (response.ok && !body?.error) return body
        if (response.status !== 404 && response.status < 500) throw new Error(`${relative} ${response.status}: ${body?.error || 'unknown'}`)
      } catch (error) { if (attempt === 5) throw error }
      await sleep(2000 * attempt)
      session = await browserTokens()
    }
  }
  const collections = (await request('/collections')).collections
  const byName = Object.fromEntries(collections.map((item) => [item.name, item]))
  for (const required of ['users', 'com_usuarios_equipes', 'com_vinculos_externos']) if (!byName[required]) throw new Error(`collection missing: ${required}`)
  const list = async (name) => (await request(`/collections/${encodeURIComponent(byName[name].id)}/records?page=1&perPage=500`)).items
  const upsert = async (name, id, payload) => {
    const existing = (await list(name)).find((item) => item.id === id)
    const relative = `/collections/${encodeURIComponent(byName[name].id)}/records${existing ? `/${encodeURIComponent(id)}` : ''}`
    const body = await request(relative, { method: existing ? 'PATCH' : 'POST', body: JSON.stringify(payload) })
    return body.record
  }
  for (const user of users) {
    const account = await upsert('users', user.id, {
      id: user.id,
      email: user.email,
      emailVisibility: true,
      name: user.name,
      password: user.password,
      passwordConfirm: user.password,
      verified: true,
      perfil_id: user.profile,
      equipe_id: TEAM_ID,
      ativo_comercial: true,
    })
    if (account.id !== user.id) throw new Error(`user mismatch: ${user.key}`)
    await upsert('com_usuarios_equipes', user.binding, {
      id: user.binding,
      usuario_id: user.id,
      perfil_id: user.profile,
      equipe_id: TEAM_ID,
      escopo: user.scope,
      ativo: true,
      inicio_vigencia: START,
      fim_vigencia: '',
    })
    if (user.external) {
      await upsert('com_vinculos_externos', user.external[0], {
        id: user.external[0],
        sistema_origem: 'activecampaign',
        external_type: 'business_owner',
        external_id: user.external[1],
        collection_name: 'users',
        record_id: user.id,
      })
    }
    delete user.password
    console.log(`provisioned ${user.key}`)
    await sleep(700)
  }
  const finalUsers = await list('users')
  const finalBindings = await list('com_usuarios_equipes')
  const finalExternal = await list('com_vinculos_externos')
  const expectedIds = new Set(users.map((user) => user.id))
  const accounts = finalUsers.filter((item) => expectedIds.has(item.id))
  const bindings = finalBindings.filter((item) => expectedIds.has(item.usuario_id))
  const external = finalExternal.filter((item) => expectedIds.has(item.record_id))
  if (accounts.length !== 6 || accounts.some((item) => !item.ativo_comercial || !item.verified)) throw new Error('final account verification failed')
  if (bindings.length !== 6 || bindings.some((item) => !item.ativo)) throw new Error('final binding verification failed')
  if (external.length !== 5) throw new Error('final external mapping verification failed')
  console.log(JSON.stringify({ users: accounts.length, active: accounts.filter((item) => item.ativo_comercial).length, verified: accounts.filter((item) => item.verified).length, bindings: bindings.length, externalMappings: external.length }))
}
main().catch((error) => { console.error(error.message); process.exit(1) })
