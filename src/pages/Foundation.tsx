import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EquipesTab } from '@/components/foundation/EquipesTab'
import { PerfisTab } from '@/components/foundation/PerfisTab'
import { PermissoesTab } from '@/components/foundation/PermissoesTab'
import { ParametrosTab } from '@/components/foundation/ParametrosTab'
import { EmpresasTab } from '@/components/foundation/EmpresasTab'
import { NegociosTab } from '@/components/foundation/NegociosTab'
import { UsuariosTab } from '@/components/foundation/UsuariosTab'
import { VinculosTab } from '@/components/foundation/VinculosTab'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'
import { ActiveCampaignReconciliationCard } from '@/components/foundation/ActiveCampaignReconciliationCard'
import { ProveloIntegrationCard } from '@/components/foundation/ProveloIntegrationCard'
import { useSearchParams } from 'react-router-dom'

export default function Foundation() {
  const { isSuperAdmin, loading: loadingSuperAdmin } = useIsSuperAdmin()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'equipes'

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Administração do Sistema</h1>
        <p className="text-sm text-muted-foreground">
          Gestão da estrutura comercial, acessos e integração com o ActiveCampaign
        </p>
      </div>
      <Tabs
        value={tab}
        onValueChange={(value) => setSearchParams({ tab: value })}
        className="w-full"
      >
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="equipes">Equipes</TabsTrigger>
          <TabsTrigger value="perfis">Perfis</TabsTrigger>
          <TabsTrigger value="permissoes">Permissões</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="vinculos">Vínculos</TabsTrigger>
          <TabsTrigger value="empresas">Empresas</TabsTrigger>
          <TabsTrigger value="negocios">Negócios</TabsTrigger>
          <TabsTrigger value="parametros">Configurações</TabsTrigger>
          <TabsTrigger value="integracao">Integração ActiveCampaign</TabsTrigger>
          <TabsTrigger value="provelo">Integração Provelo</TabsTrigger>
        </TabsList>
        <TabsContent value="equipes">
          <EquipesTab />
        </TabsContent>
        <TabsContent value="perfis">
          <PerfisTab />
        </TabsContent>
        <TabsContent value="permissoes">
          <PermissoesTab />
        </TabsContent>
        <TabsContent value="usuarios">
          <UsuariosTab />
        </TabsContent>
        <TabsContent value="vinculos">
          <VinculosTab />
        </TabsContent>
        <TabsContent value="empresas">
          <EmpresasTab />
        </TabsContent>
        <TabsContent value="negocios">
          <NegociosTab />
        </TabsContent>
        <TabsContent value="parametros">
          <ParametrosTab />
        </TabsContent>
        <TabsContent value="integracao">
          {isSuperAdmin && !loadingSuperAdmin ? <ActiveCampaignReconciliationCard /> : null}
        </TabsContent>{' '}
        <TabsContent value="provelo">
          {isSuperAdmin && !loadingSuperAdmin ? <ProveloIntegrationCard /> : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}
