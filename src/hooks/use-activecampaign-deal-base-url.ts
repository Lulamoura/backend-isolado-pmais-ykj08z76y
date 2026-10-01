import { useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import {
  ACTIVE_CAMPAIGN_DEAL_BASE_URL_PARAM,
  DEFAULT_ACTIVE_CAMPAIGN_DEAL_BASE_URL,
  normalizarActiveCampaignDealBaseUrl,
} from '@/lib/activecampaign-deal-url'

let baseUrlPromise: Promise<string> | null = null

function carregarActiveCampaignDealBaseUrl(): Promise<string> {
  if (!baseUrlPromise) {
    const request = pb
      .collection('com_parametros')
      .getFirstListItem(`chave = "${ACTIVE_CAMPAIGN_DEAL_BASE_URL_PARAM}" && ativo = true`)
      .then((record) => normalizarActiveCampaignDealBaseUrl(String(record.valor || '')))
      .catch(() => DEFAULT_ACTIVE_CAMPAIGN_DEAL_BASE_URL)

    baseUrlPromise = request
    void request.finally(() => {
      if (baseUrlPromise === request) baseUrlPromise = null
    })
  }

  return baseUrlPromise
}

export function useActiveCampaignDealBaseUrl(): string {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_ACTIVE_CAMPAIGN_DEAL_BASE_URL)

  useEffect(() => {
    let active = true
    void carregarActiveCampaignDealBaseUrl().then((valor) => {
      if (active) setBaseUrl(valor)
    })
    return () => {
      active = false
    }
  }, [])

  return baseUrl
}
