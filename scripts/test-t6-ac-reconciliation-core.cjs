const assert = require('node:assert/strict')
const {
  planReconciliation,
  simulateReconciliationPersistence,
  executePlan,
} = require('./lib/ac-reconciliation-core.cjs')

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

// ================= TESTES ESPECÍFICOS DE DEDUPLICAÇÃO E ATOMICIDADE =================

// 1. Sobreposição do mesmo deal em duas páginas com mesmo id/mdate (mesmo event_id) -> um único evento e simulação sem colisão
{
  const duplicateEvents = [
    event('100', '2026-08-28T10:00:00.000Z'),
    event('100', '2026-08-28T10:00:00.000Z'),
  ]
  const dedupPlan = planReconciliation({ events: duplicateEvents })
  assert.equal(
    dedupPlan.actions.length,
    1,
    'Eventos duplicados devem ser deduplicados por event_id',
  )
  assert.equal(dedupPlan.counts.create, 1)

  // A persistência da simulação não colide a chave de idempotência
  const simResult = simulateReconciliationPersistence({
    dryRunId: 'dry_100',
    actions: dedupPlan.actions,
  })
  assert.equal(simResult.success, true)
  assert.equal(Object.keys(simResult.state.plan_items).length, 1)
}

// 2. Mesmo negócio com event_id / source_version diferentes -> preservar ambos
{
  const distinctVersionEvents = [
    event('200', '2026-08-28T10:00:00.000Z', { title: 'Versão 1' }),
    event('200', '2026-08-28T11:00:00.000Z', { title: 'Versão 2' }),
  ]
  const multiVersionPlan = planReconciliation({ events: distinctVersionEvents })
  assert.equal(
    multiVersionPlan.actions.length,
    2,
    'Eventos com event_id / source_version distintas devem ser preservados',
  )

  const simResult = simulateReconciliationPersistence({
    dryRunId: 'dry_200',
    actions: multiVersionPlan.actions,
  })
  assert.equal(simResult.success, true)
  assert.equal(Object.keys(simResult.state.plan_items).length, 2)
}

// 3. Chaves dos itens do plano (idempotency_key) sempre únicas
{
  const multiEvents = [event('301', '1'), event('302', '1'), event('303', '1')]
  const multiPlan = planReconciliation({ events: multiEvents })
  const simResult = simulateReconciliationPersistence({
    dryRunId: 'dry_300',
    actions: multiPlan.actions,
  })
  assert.equal(simResult.success, true)
  const itemKeys = Object.keys(simResult.state.plan_items)
  assert.equal(itemKeys.length, 3)
  const uniqueKeys = new Set(itemKeys)
  assert.equal(
    uniqueKeys.size,
    3,
    'Todas as chaves de idempotência dos itens de plano devem ser estritamente únicas',
  )
}

// 4. Falha de persistência não deixa dry-run nem plano parcial (atomicidade)
{
  const multiEvents = [event('401', '1'), event('402', '1')]
  const multiPlan = planReconciliation({ events: multiEvents })
  const initialState = { dry_runs: {}, plan_items: {}, quality_issues: [] }

  // Falha no meio da transação de persistência da simulação
  const failedSimResult = simulateReconciliationPersistence({
    dryRunId: 'dry_400',
    actions: multiPlan.actions,
    failAt: 2, // falha no segundo item
    state: initialState,
  })

  assert.equal(failedSimResult.success, false)
  assert.equal(
    Object.keys(failedSimResult.state.dry_runs).length,
    0,
    'Dry-run não deve ficar persistido em caso de erro',
  )
  assert.equal(
    Object.keys(failedSimResult.state.plan_items).length,
    0,
    'Itens do plano não devem ficar órfãos em caso de erro',
  )
}

console.log('PASS T6.AC reconciliation core 18/18')
