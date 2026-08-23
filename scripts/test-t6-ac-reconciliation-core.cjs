const assert = require('node:assert/strict')
const { planReconciliation, executePlan } = require('./lib/ac-reconciliation-core.cjs')

const event = (id, version, data = { title: `Negócio ${version}` }) => ({
  schema_version: '1',
  event_id: `ac:business:${id}:${version}`,
  source: 'activecampaign',
  entity_type: 'business',
  entity_id: id,
  action: 'upsert',
  occurred_at: '2026-08-23T12:00:00.000Z',
  source_version: String(version),
  correlation_id: 'teste-t6-ac',
  data,
  links: { company_id: '10', contact_id: '20', owner_code: 'Vendedor 1' },
})

const first = planReconciliation({ events: [event('1', 1)], localByExternalKey: {}, cursor: 'c0' })
assert.equal(first.counts.create, 1)
assert.match(first.fingerprint, /^[a-f0-9]{64}$/)

const reorderedEvent = {
  links: { owner_code: 'Vendedor 1', contact_id: '20', company_id: '10' },
  data: { title: 'Negócio 1' },
  correlation_id: 'teste-t6-ac',
  source_version: '1',
  occurred_at: '2026-08-23T12:00:00.000Z',
  action: 'upsert',
  entity_id: '1',
  entity_type: 'business',
  source: 'activecampaign',
  event_id: 'ac:business:1:1',
  schema_version: '1',
}
const reordered = planReconciliation({
  events: [reorderedEvent],
  localByExternalKey: {},
  cursor: 'c0',
})
assert.equal(reordered.fingerprint, first.fingerprint)

const applied = executePlan({ plan: first, fingerprint: first.fingerprint, state: {} })
assert.equal(applied.applied, true)
assert.equal(applied.state['business:1'].source_version, '1')

const second = planReconciliation({
  events: [event('1', 2)],
  localByExternalKey: applied.state,
  cursor: 'c1',
})
assert.equal(second.counts.update, 1)

const replay = planReconciliation({
  events: [event('1', 1)],
  localByExternalKey: applied.state,
})
assert.equal(replay.counts.replay, 1)

const staleState = {
  ...applied.state,
  'business:1': { ...applied.state['business:1'], source_version: '3' },
}
const stale = planReconciliation({ events: [event('1', 2)], localByExternalKey: staleState })
assert.equal(stale.counts.stale, 1)

const conflict = planReconciliation({
  events: [event('1', 1, { title: 'conteúdo divergente' })],
  localByExternalKey: applied.state,
})
assert.equal(conflict.counts.conflict, 1)

assert.throws(
  () => executePlan({ plan: first, fingerprint: '0'.repeat(64), state: {} }),
  /FINGERPRINT_OBSOLETO/,
)

const rollback = executePlan({ plan: first, fingerprint: first.fingerprint, state: {}, failAt: 0 })
assert.equal(rollback.applied, false)
assert.deepEqual(rollback.state, {})
assert.equal(rollback.cursor, null)

assert.throws(
  () =>
    executePlan({
      plan: first,
      fingerprint: first.fingerprint,
      state: {},
      lockHeld: true,
    }),
  /RECONCILIACAO_EM_ANDAMENTO/,
)

const dependencies = {
  company: new Set(['10']),
  contact: new Set(['20']),
  owner: new Set(['Vendedor 1']),
  stage: new Set(['prospects']),
}
const mapped = event('2', 1, { title: 'Mapeado', stage: 'prospects' })
const mappedPlan = planReconciliation({ events: [mapped], dependencies })
assert.equal(mappedPlan.counts.create, 1)

const unknownOwner = {
  ...mapped,
  event_id: 'ac:business:2:2',
  source_version: '2',
  links: { ...mapped.links, owner_code: 'Vendedor 3' },
}
assert.equal(planReconciliation({ events: [unknownOwner], dependencies }).counts.error, 1)

const unknownStage = {
  ...mapped,
  event_id: 'ac:business:2:3',
  source_version: '3',
  data: { ...mapped.data, stage: 'sem-alias' },
}
assert.equal(planReconciliation({ events: [unknownStage], dependencies }).counts.error, 1)

const recovered = planReconciliation({
  events: [event('1', 1), event('3', 1)],
  localByExternalKey: applied.state,
})
assert.equal(recovered.counts.replay, 1)
assert.equal(recovered.counts.create, 1)

const invalid = planReconciliation({ events: [{ event_id: 'incompleto' }] })
assert.equal(invalid.counts.error, 1)

console.log('PASS T6.AC reconciliation core 14/14')
