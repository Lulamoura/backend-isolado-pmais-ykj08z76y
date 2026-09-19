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
import { useSearchParams } from 'react-router-dom'

export default function Foundation() {
  const { isSuperAdmin, loading: loadingSuperAdmin } = useIsSuperAdmin()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'equipes'

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Governança · Estrutura e Parâmetros
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Administração do Sistema
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
            Gestão da estrutura comercial, acessos, parâmetros operacionais e integração com o
            ActiveCampaign.
          </p>
        </div>
      </section>

      <Tabs
        value={tab}
        onValueChange={(value) => setSearchParams({ tab: value })}
        className="space-y-6 w-full"
      >
        <TabsList className="flex-wrap h-auto p-1.5 bg-slate-100/80 border border-slate-200/80 rounded-xl gap-1">
          <TabsTrigger
            value="equipes"
            className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-slate-600 transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
          >
            Equipes
          </TabsTrigger>
          <TabsTrigger
            value="perfis"
            className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-slate-600 transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
          >
            Perfis
          </TabsTrigger>
          <TabsTrigger
            value="permissoes"
            className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-slate-600 transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
          >
            Permissões
          </TabsTrigger>
          <TabsTrigger
            value="usuarios"
            className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-slate-600 transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
          >
            Usuários
          </TabsTrigger>
          <TabsTrigger
            value="vinculos"
            className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-slate-600 transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
          >
            Vínculos
          </TabsTrigger>
          <TabsTrigger
            value="empresas"
            className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-slate-600 transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
          >
            Empresas
          </TabsTrigger>
          <TabsTrigger
            value="negocios"
            className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-slate-600 transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
          >
            Negócios
          </TabsTrigger>
          <TabsTrigger
            value="parametros"
            className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-slate-600 transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
          >
            Configurações
          </TabsTrigger>
          <TabsTrigger
            value="integracao"
            className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-slate-600 transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
          >
            Integração ActiveCampaign
          </TabsTrigger>
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
