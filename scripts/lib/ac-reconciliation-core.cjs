const crypto = require('node:crypto')

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(',')}}`
}

function hash(value) {
  return crypto.createHash('sha256').update(canonical(value)).digest('hex')
}

function validateEnvelope(event) {
  const required = [
    'schema_version',
    'event_id',
    'source',
    'entity_type',
    'entity_id',
    'action',
    'occurred_at',
    'source_version',
    'correlation_id',
    'data',
  ]
  for (const field of required) if (event[field] === undefined || event[field] === '') return field
  if (event.schema_version !== '1' || event.source !== 'activecampaign') return 'contract'
  if (!['company', 'contact', 'business'].includes(event.entity_type)) return 'entity_type'
  if (!['upsert', 'archive'].includes(event.action)) return 'action'
  if (Number.isNaN(Date.parse(event.occurred_at))) return 'occurred_at'
  return null
}

function planReconciliation({
  events,
  localByExternalKey = {},
  cursor = null,
  dependencies = null,
}) {
  const actions = []
  for (const event of events) {
    const invalid = validateEnvelope(event)
    const externalKey = `${event.entity_type}:${event.entity_id}`
    if (invalid) {
      actions.push({ kind: 'error', externalKey, event_id: event.event_id, reason: invalid })
      continue
    }
    if (event.entity_type === 'business' && dependencies) {
      const links = event.links || {}
      const missing = [
        ['company', links.company_id],
        ['contact', links.contact_id],
        ['owner', links.owner_code],
        ['stage', event.data.stage],
      ].find(([type, id]) => !id || !dependencies[type]?.has(String(id)))
      if (missing) {
        actions.push({
          kind: 'error',
          externalKey,
          event_id: event.event_id,
          reason: `missing_${missing[0]}`,
        })
        continue
      }
    }
    const local = localByExternalKey[externalKey]
    const eventHash = hash(event)
    if (!local) {
      actions.push({ kind: 'create', externalKey, event_id: event.event_id, eventHash, event })
      continue
    }
    if (local.event_id === event.event_id && local.event_hash === eventHash) {
      actions.push({ kind: 'replay', externalKey, event_id: event.event_id })
      continue
    }
    const versionCmp = String(event.source_version).localeCompare(
      String(local.source_version),
      'en',
      {
        numeric: true,
      },
    )
    if (versionCmp < 0) {
      actions.push({ kind: 'stale', externalKey, event_id: event.event_id })
      continue
    }
    if (versionCmp === 0 && local.event_hash !== eventHash) {
      actions.push({ kind: 'conflict', externalKey, event_id: event.event_id })
      continue
    }
    actions.push({ kind: 'update', externalKey, event_id: event.event_id, eventHash, event })
  }
  const counts = actions.reduce((acc, item) => {
    acc[item.kind] = (acc[item.kind] || 0) + 1
    return acc
  }, {})
  const plan = { cursor, actions, counts }
  return { ...plan, fingerprint: hash(plan) }
}

function executePlan({ plan, fingerprint, state, failAt = -1, lockHeld = false, cursor = null }) {
  if (plan.fingerprint !== fingerprint) throw new Error('FINGERPRINT_OBSOLETO')
  if (lockHeld) throw new Error('RECONCILIACAO_EM_ANDAMENTO')
  const before = structuredClone(state)
  const next = structuredClone(state)
  try {
    plan.actions.forEach((action, index) => {
      if (index === failAt) throw new Error('FALHA_SINTETICA')
      if (!['create', 'update'].includes(action.kind)) return
      next[action.externalKey] = {
        event_id: action.event_id,
        event_hash: action.eventHash,
        source_version: action.event.source_version,
        data: structuredClone(action.event.data),
      }
    })
    return { state: next, replay: false, applied: true, cursor: plan.cursor }
  } catch (error) {
    return { state: before, replay: false, applied: false, error: error.message, cursor }
  }
}

module.exports = { canonical, hash, validateEnvelope, planReconciliation, executePlan }
