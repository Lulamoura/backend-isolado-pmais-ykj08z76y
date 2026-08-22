const http = require('node:http')

const PREVIEW = 'https://backend-isolado-pmais-43b9c--preview.goskip.app'
const users = new Map([
  ['CRISTIANE', false],
  ['RAQUEL', false],
  ['VIVIANE', false],
  ['RITA', false],
  ['SHIRLEIDE', false],
  ['LULA', true],
])
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
function getJson(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method }, (response) => {
      let data = ''
      response.on('data', (chunk) => (data += chunk))
      response.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve(data) }
      })
    })
    request.on('error', reject)
    request.end()
  })
}
async function main() {
  if (process.argv[2] !== 'QA-PREVIEW-USERS-52022') throw new Error('explicit confirmation required')
  const key = process.argv[3]
  if (!users.has(key)) throw new Error('valid user key required')
  const adminExpected = users.get(key)
  const identity = process.env[`PMAIS_${key}_USERNAME`]
  const password = process.env[`PMAIS_${key}_PASSWORD`]
  if (!identity || !password) throw new Error(`credential unavailable: ${key}`)
  console.error(`${key}: opening isolated tab`)
  const page = await getJson(`http://127.0.0.1:19222/json/new?${encodeURIComponent(`${PREVIEW}/login`)}`, 'PUT')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    const request = pending.get(message.id)
    if (!request) return
    pending.delete(message.id)
    message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result)
  }
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  console.error(`${key}: connected`)
  const send = (method, params = {}) => {
    const requestId = ++id
    ws.send(JSON.stringify({ id: requestId, method, params }))
    return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }))
  }
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'evaluation failed')
    return result.result.value
  }
  try {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await sleep(300)
      if (await evaluate('document.readyState === "complete" && !!document.querySelector("input[type=email]")')) break
    }
    await evaluate('localStorage.clear(); sessionStorage.clear(); true')
    await send('Page.reload', { ignoreCache: true })
    await sleep(1500)
    console.error(`${key}: submitting login`)
    const submitted = await evaluate(`(() => {
      const inputs=[...document.querySelectorAll('input')];
      const email=inputs.find((item)=>item.type==='email');
      const password=inputs.find((item)=>item.type==='password');
      const button=[...document.querySelectorAll('button')].find((item)=>item.textContent.trim()==='Entrar');
      if(!email||!password||!button)return false;
      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      setter.call(email,${JSON.stringify(identity)}); email.dispatchEvent(new Event('input',{bubbles:true})); email.dispatchEvent(new Event('change',{bubbles:true}));
      setter.call(password,${JSON.stringify(password)}); password.dispatchEvent(new Event('input',{bubbles:true})); password.dispatchEvent(new Event('change',{bubbles:true}));
      button.click(); return true;
    })()`)
    if (!submitted) throw new Error(`login form unavailable: ${key}`)
    await sleep(5000)
    console.error(`${key}: inspecting authenticated home`)
    const home = await evaluate(`({path:location.pathname,text:document.body.innerText.slice(0,12000),links:[...document.querySelectorAll('a')].map((item)=>item.textContent.trim()).filter(Boolean)})`)
    const loginOk = home.path !== '/login' && !home.text.includes('Credenciais inválidas')
    const adminVisible = home.text.includes('Administração') || home.links.includes('Administração')
    await send('Page.navigate', { url: `${PREVIEW}/foundation` })
    await sleep(3500)
    console.error(`${key}: inspecting authorization route`)
    const foundation = await evaluate(`({path:location.pathname,text:document.body.innerText.slice(0,8000)})`)
    const notFound = /página não encontrada|page not found|404/i.test(foundation.text)
    const result = { user: key, loginOk, homePath: home.path, adminVisible, adminExpected, foundationAllowed: !notFound }
    const passed = result.loginOk && result.adminVisible === result.adminExpected && result.foundationAllowed === result.adminExpected
    console.log(JSON.stringify({ passed, result }, null, 2))
    if (!passed) process.exitCode = 1
  } finally {
    ws.close()
    await getJson(`http://127.0.0.1:19222/json/close/${page.id}`)
  }
}
main().catch((error) => { console.error(error.message); process.exit(1) })
