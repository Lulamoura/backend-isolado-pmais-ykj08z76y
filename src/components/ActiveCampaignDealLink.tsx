import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildActiveCampaignDealUrl } from '@/lib/activecampaign-deal-url'
import { useActiveCampaignDealBaseUrl } from '@/hooks/use-activecampaign-deal-base-url'

interface ActiveCampaignDealLinkProps {
  dealId?: string | number | null
  label?: string
  compact?: boolean
  className?: string
}

export function ActiveCampaignDealLink({
  dealId,
  label = 'Abrir no ActiveCampaign',
  compact = false,
  className,
}: ActiveCampaignDealLinkProps) {
  const baseUrl = useActiveCampaignDealBaseUrl()
  const url = buildActiveCampaignDealUrl(baseUrl, dealId)
  if (!url) return null

  return (
    <Button variant="outline" size="sm" className={className} asChild>
      <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${label} ${dealId}`}>
        <ExternalLink className={compact ? 'h-3.5 w-3.5' : 'mr-1.5 h-4 w-4'} />
        {compact ? <span className="sr-only">{label}</span> : label}
      </a>
    </Button>
  )
}
