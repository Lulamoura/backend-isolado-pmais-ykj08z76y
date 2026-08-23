import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EquipesTab } from '@/components/foundation/EquipesTab'
import { PerfisTab } from '@/components/foundation/PerfisTab'
import { PermissoesTab } from '@/components/foundation/PermissoesTab'
import { ParametrosTab } from '@/components/foundation/ParametrosTab'
import { EmpresasTab } from '@/components/foundation/EmpresasTab'
import { NegociosTab } from '@/components/foundation/NegociosTab'
import { UsuariosTab } from '@/components/foundation/UsuariosTab'
import { VinculosTab } from '@/components/foundation/VinculosTab'
import { IntegrationTestsTab } from '@/components/foundation/IntegrationTestsTab'
import { DiagConsultaDependenciasBlock } from '@/components/foundation/DiagConsultaDependenciasBlock'
import { Porta2D2BAuditBlock } from '@/components/foundation/Porta2D2BAuditBlock'
import { Porta2D2BEvidenceQueryBlock } from '@/components/foundation/Porta2D2BEvidenceQueryBlock'
import { DiagCompensacaoAuditEvidenceBlock } from '@/components/foundation/DiagCompensacaoAuditEvidenceBlock'
import { DiagCompensacaoDependenciasBlock } from '@/components/foundation/DiagCompensacaoDependenciasBlock'
import { DiagTransportEvidenceBlock } from '@/components/foundation/DiagTransportEvidenceBlock'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'
import { ActiveCampaignReconciliationCard } from '@/components/foundation/ActiveCampaignReconciliationCard'

export default function Foundation() {
  const { isSuperAdmin, loading: loadingSuperAdmin } = useIsSuperAdmin()

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Foundation</h1>
        <p className="text-sm text-muted-foreground">Gestão de estrutura comercial e integrações</p>
      </div>
      <Tabs defaultValue="equipes" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="equipes">Equipes</TabsTrigger>
          <TabsTrigger value="perfis">Perfis</TabsTrigger>
          <TabsTrigger value="permissoes">Permissões</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="vinculos">Vínculos</TabsTrigger>
          <TabsTrigger value="empresas">Empresas</TabsTrigger>
          <TabsTrigger value="negocios">Negócios</TabsTrigger>
          <TabsTrigger value="parametros">Parâmetros</TabsTrigger>
          <TabsTrigger value="integracao">Integração 2D.2A</TabsTrigger>
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
          <div className="space-y-4">
            <IntegrationTestsTab />
            <DiagTransportEvidenceBlock />
            <DiagCompensacaoAuditEvidenceBlock />
            <DiagCompensacaoDependenciasBlock />
            <DiagConsultaDependenciasBlock />
            {isSuperAdmin && !loadingSuperAdmin ? (
              <>
                <ActiveCampaignReconciliationCard />
                <Porta2D2BAuditBlock />
                <Porta2D2BEvidenceQueryBlock />
              </>
            ) : null}
          </div>
        </TabsContent>{' '}
      </Tabs>
    </div>
  )
}
