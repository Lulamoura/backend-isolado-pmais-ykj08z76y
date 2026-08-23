function selectInitialOpenNegotiation({
  deals,
  pipelineId,
  negotiationStageId,
  customByDeal = {},
}) {
  return deals
    .filter(
      (deal) =>
        String(deal.group) === String(pipelineId) &&
        String(deal.status) === '0' &&
        String(deal.stage) === String(negotiationStageId),
    )
    .map((deal) => {
      const fields = customByDeal[String(deal.id)] || {}
      const exceptions = []
      if (!fields.Responsável) exceptions.push('missing_owner')
      if (Number(deal.value || 0) <= 1) exceptions.push('unpriced_or_technical_value')
      if (!String(deal.contact || '')) exceptions.push('missing_contact')
      if (!String(deal.account || deal.organization || '')) exceptions.push('missing_company')
      return {
        id: String(deal.id),
        ownerCode: fields.Responsável || '',
        valueCents: Number(deal.value || 0),
        exceptions,
      }
    })
}

function canMutateRealImported({ preoperationReadOnly, originChannel }) {
  return !(preoperationReadOnly && originChannel === 'activecampaign')
}

module.exports = { selectInitialOpenNegotiation, canMutateRealImported }
