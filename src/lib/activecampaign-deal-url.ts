export const ACTIVE_CAMPAIGN_DEAL_BASE_URL_PARAM = 'activecampaign.deal_base_url'
export const DEFAULT_ACTIVE_CAMPAIGN_DEAL_BASE_URL =
  'https://pmaisservicos89463.activehosted.com/app/deals/'

export function normalizarActiveCampaignDealBaseUrl(value?: string | null): string {
  const raw = String(value || '').trim() || DEFAULT_ACTIVE_CAMPAIGN_DEAL_BASE_URL
  return raw.endsWith('/') ? raw : `${raw}/`
}

export function activeCampaignDealId(value?: string | number | null): string {
  const normalized = String(value ?? '').trim()
  if (!normalized) return ''
  const match = normalized.match(/\d+/)
  return match ? match[0] : ''
}

export function buildActiveCampaignDealUrl(
  baseUrl: string | null | undefined,
  dealId: string | number | null | undefined,
): string {
  const id = activeCampaignDealId(dealId)
  if (!id) return ''
  return `${normalizarActiveCampaignDealBaseUrl(baseUrl)}${encodeURIComponent(id)}`
}
