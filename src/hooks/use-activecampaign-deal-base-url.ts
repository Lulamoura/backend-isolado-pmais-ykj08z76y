import { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import {
  ACTIVE_CAMPAIGN_DEAL_BASE_URL_PARAM,
  DEFAULT_ACTIVE_CAMPAIGN_DEAL_BASE_URL,
  normalizarActiveCampaignDealBaseUrl,
} from '@/lib/activecampaign-deal-url'

export function useActiveCampaignDealBaseUrl(): string {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_ACTIVE_CAMPAIGN_DEAL_BASE_URL)

  useEffect(() => {
    let active = true
    pb.collection('com_parametros')
      .getFirstListItem(`chave = "${ACTIVE_CAMPAIGN_DEAL_BASE_URL_PARAM}" && ativo = true`)
      .then((record) => {
        if (active) setBaseUrl(normalizarActiveCampaignDealBaseUrl(String(record.valor || '')))
      })
      .catch(() => {
        if (active) setBaseUrl(DEFAULT_ACTIVE_CAMPAIGN_DEAL_BASE_URL)
      })
    return () => {
      active = false
    }
  }, [])

  return baseUrl
}
