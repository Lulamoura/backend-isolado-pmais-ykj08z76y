const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

const PROJECT_ID = 52022
const PROJECT_UUID = '9bd690dc-fec2-4b18-88f1-11f6cc1329a5'
const EXPECTED_FINGERPRINT = '4552a681f36569042b2d4c0c7301e085f8a0a36f6d9e439546e846e3ae7b6a55'
const BATCH_SIZES = [5, 6, 6, 6, 6]

const root = path.resolve(__dirname, '..')
const reportPath = path.resolve(
  root,
  '../../output/aplicacao-comercial-pmais/t62-r2-admin-baseline-dry-run.json',
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

async function main() {
  const batchName = process.argv[2]
  const confirmation = process.argv[3]
  const batchIndex = Number(batchName?.match(/^batch-(\d+)$/)?.[1]) - 1
  if (
    !Number.isInteger(batchIndex) ||
    batchIndex < 0 ||
    batchIndex >= BATCH_SIZES.length ||
    confirmation !== `APPLY-52022-${batchName.toUpperCase()}`
  ) {
    throw new Error('explicit batch confirmation is required')
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
  if (report.operationsFingerprint !== EXPECTED_FINGERPRINT) {
    throw new Error('dry-run fingerprint mismatch')
  }
  const allOperations = report.operations.filter(
    (operation) => operation.type === 'create_collection_skeleton',
  )
  const start = BATCH_SIZES.slice(0, batchIndex).reduce((sum, size) => sum + size, 0)
  const operations = allOperations.slice(start, start + BATCH_SIZES[batchIndex])
  const names = operations.map((operation) => operation.collection)
  const expectedBefore = allOperations.slice(0, start).map((operation) => operation.collection)
  if (operations.length !== names.length) throw new Error('batch operation mismatch')

  const pages = await getJson('http://127.0.0.1:19222/json/list')
  const page = pages.find((item) => item.url?.includes(`/builder/${PROJECT_UUID}`))
  if (!page) throw new Error('candidate browser target not found')

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

  const expression = `
    (async () => {
      const projectId = ${PROJECT_ID};
      const expectedBefore = ${JSON.stringify(expectedBefore)};
      const operations = ${JSON.stringify(operations)};
      const base = 'https://api.goskip.dev/v1/projects/' + projectId + '/integrations/skip-cloud';
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const session = () => JSON.parse(localStorage.getItem('skip-auth') || '{}')?.state?.session;
      async function request(relative, options = {}) {
        const current = session();
        if (!current?.access_token || !current?.refresh_token) throw new Error('browser session unavailable');
        const response = await fetch(base + relative, {
          ...options,
          headers: {
            'content-type': 'application/json',
            'x-access-token': current.access_token,
            'x-refresh-token': current.refresh_token,
          },
        });
        const text = await response.text();
        let body = null;
        try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 300) }; }
        return { ok: response.ok && !body?.error, status: response.status, body };
      }
      async function state() {
        const [collectionsResponse, migrationsResponse] = await Promise.all([
          request('/collections'),
          request('/migrations'),
        ]);
        if (!collectionsResponse.ok || !migrationsResponse.ok) throw new Error('state read failed');
        return {
          collections: collectionsResponse.body.collections,
          migrations: migrationsResponse.body.migrations,
        };
      }
      const before = await state();
      const beforeNames = before.collections.map((item) => item.name).sort();
      const wantedBefore = ['users', ...expectedBefore].sort();
      if (JSON.stringify(beforeNames) !== JSON.stringify(wantedBefore)) {
        throw new Error('pre-state schema mismatch');
      }
      for (const collection of before.collections) {
        const records = await request('/collections/' + encodeURIComponent(collection.id) + '/records?page=1&perPage=1');
        if (!records.ok || records.body.totalItems !== 0) throw new Error(collection.name + ' is not empty');
      }
      const results = [];
      for (const operation of operations) {
        let applied = false;
        for (let attempt = 1; attempt <= 3 && !applied; attempt += 1) {
          const response = await request('/collections', {
            method: 'POST',
            body: JSON.stringify(operation.payload),
          });
          if (response.ok) {
            applied = true;
            results.push({ collection: operation.collection, attempt, status: response.status });
            break;
          }
          if (response.status !== 404) {
            throw new Error(operation.collection + ' failed (' + response.status + '): ' + (response.body?.error || 'unknown'));
          }
          await sleep(2500 * attempt);
          const checkpoint = await state();
          if (checkpoint.collections.some((item) => item.name === operation.collection)) {
            applied = true;
            results.push({ collection: operation.collection, attempt, status: 'confirmed-after-404' });
            break;
          }
        }
        if (!applied) throw new Error(operation.collection + ' unavailable after retries');
        await sleep(1800);
        const checkpoint = await state();
        const collection = checkpoint.collections.find((item) => item.name === operation.collection);
        if (!collection) throw new Error(operation.collection + ' missing after create');
        if (collection.fields.some((field) => field.type === 'relation')) {
          throw new Error(operation.collection + ' skeleton has a relation');
        }
      }
      const after = await state();
      const afterNames = after.collections.map((item) => item.name).sort();
      const wantedAfter = ['users', ...expectedBefore, ...operations.map((item) => item.collection)].sort();
      if (JSON.stringify(afterNames) !== JSON.stringify(wantedAfter)) throw new Error('post-state schema mismatch');
      return {
        projectId,
        batch: ${JSON.stringify(batchName)},
        results,
        collections: after.collections.map((item) => item.name),
        migrations: after.migrations.map((item) => item.name),
      };
    })()
  `
  const evaluation = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  ws.close()
  if (evaluation.exceptionDetails) {
    throw new Error(
      evaluation.exceptionDetails.exception?.description || 'browser evaluation failed',
    )
  }
  console.log(JSON.stringify(evaluation.result.value, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
