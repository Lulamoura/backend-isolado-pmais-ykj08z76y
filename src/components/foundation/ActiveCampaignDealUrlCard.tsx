import { useEffect, useState } from 'react'
import { Link2 } from 'lucide-react'
import type { RecordModel } from 'pocketbase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getParametros } from '@/services/foundation'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { ParametroAmigavelCard } from './ParametroAmigavelCard'
import { PARAMETROS_INTEGRACAO_ACTIVECAMPAIGN } from './parametros-amigaveis'

export function ActiveCampaignDealUrlCard() {
  const { user } = useAuth()
  const [records, setRecords] = useState<RecordModel[]>([])

  const load = async () => setRecords(await getParametros())

  useEffect(() => {
    void load()
  }, [])

  useRealtime('com_parametros', () => {
    void load()
  })

  const parametroUrl = records.find(
    (record) => String(record.chave) === 'activecampaign.deal_base_url',
  )
  const definicaoUrl = PARAMETROS_INTEGRACAO_ACTIVECAMPAIGN[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" /> Links dos negócios no ActiveCampaign
        </CardTitle>
        <CardDescription>
          Configure a URL usada pelos botões “Abrir no ActiveCampaign” exibidos nos cards de
          negócio. O aplicativo acrescenta automaticamente o número do negócio ao final.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {parametroUrl ? (
          <ParametroAmigavelCard
            definicao={definicaoUrl}
            parametro={parametroUrl}
            autorId={user?.id}
            onUpdated={load}
          />
        ) : (
          <Alert>
            <AlertDescription>
              O parâmetro de URL ainda não foi materializado na base. Atualize o Preview ou peça a
              criação do parâmetro padrão antes de alterar este endereço.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
