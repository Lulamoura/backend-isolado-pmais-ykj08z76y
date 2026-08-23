const assert = require('node:assert/strict')
const {
  selectInitialOpenNegotiation,
  canMutateRealImported,
} = require('./lib/ac-preload-scope.cjs')

const deals = [
  { id: 1, group: 4, status: 0, stage: 30, value: 10000, contact: 10, account: 20 },
  { id: 2, group: 4, status: 0, stage: 10, value: 20000, contact: 11, account: 21 },
  { id: 3, group: 4, status: 1, stage: 30, value: 30000, contact: 12, account: 22 },
  { id: 4, group: 4, status: 0, stage: 30, value: 1, contact: 13, account: 23 },
]
const custom = {
  1: { Responsável: 'Vendedor 1' },
  4: { Responsável: 'Vendedor 5' },
}
const selected = selectInitialOpenNegotiation({
  deals,
  pipelineId: 4,
  negotiationStageId: 30,
  customByDeal: custom,
})
assert.deepEqual(
  selected.map((row) => row.id),
  ['1', '4'],
)
assert.deepEqual(selected[0].exceptions, [])
assert.deepEqual(selected[1].exceptions, ['unpriced_or_technical_value'])
assert.equal(
  canMutateRealImported({ preoperationReadOnly: true, originChannel: 'activecampaign' }),
  false,
)
assert.equal(canMutateRealImported({ preoperationReadOnly: true, originChannel: 'teste' }), true)
assert.equal(
  canMutateRealImported({ preoperationReadOnly: false, originChannel: 'activecampaign' }),
  true,
)
console.log('PASS T6.AC.8-R preload/preoperation 6/6')
