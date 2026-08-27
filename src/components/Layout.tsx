import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Building2, ChevronRight, KeyRound, LogOut } from 'lucide-react'

import { ChangePasswordDialog } from '@/components/foundation/ChangePasswordDialog'
import { ModuleTabs } from '@/components/ModuleTabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { useAuth } from '@/hooks/use-auth'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'
import { usePermissions } from '@/hooks/use-permissions'
import { MUTATIONS_ENABLED } from '@/lib/feature-flags'
import { cn } from '@/lib/utils'
import { MAIN_MODULES, modulePathFor } from '@/lib/navigation'
import AccessDenied from '@/pages/AccessDenied'

const SUBSTITUICOES_ALLOWLIST = new Set([
  'superadministrador',
  'gestor',
  'gestor-comercial',
  'operador-comercial',
  'prospeccao',
])

export function getSubstituicoesPageTitle(pathname: string, mutationsEnabled = true) {
  if (pathname === '/substituicoes' || pathname === '/substituicoes/') return 'Substituições'
  if (pathname === '/substituicoes/nova' || pathname === '/substituicoes/nova/') {
    return mutationsEnabled ? 'Nova substituição' : null
  }
  if (/^\/substituicoes\/[^/]+\/ajustar\/?$/.test(pathname)) {
    return mutationsEnabled ? 'Ajustar substituição' : null
  }
  if (/^\/substituicoes\/[^/]+\/?$/.test(pathname)) return 'Detalhes da substituição'
  return null
}

function LayoutContent() {
  const { user, signOut } = useAuth()
  const { perfilSlug, loading: perfilLoading } = useIsSuperAdmin()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const { setOpenMobile } = useSidebar()
  const location = useLocation()
  const navigate = useNavigate()
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)

  const podeVerSubstituicoes =
    !perfilLoading &&
    user?.ativo_comercial === true &&
    SUBSTITUICOES_ALLOWLIST.has(perfilSlug ?? '')

  const podeAdministrar =
    !permissionsLoading &&
    [
      'foundation.manage',
      'usuarios.admin',
      'equipes.admin',
      'perfis.admin',
      'permissoes.admin',
      'vinculos.admin',
      'parametros.gerenciar',
    ].some(hasPermission)

  const navigation = MAIN_MODULES.filter((item) => {
    if (user?.ativo_comercial !== true) return false
    if (item.path === '/foundation') return podeAdministrar
    return true
  })

  const handleLogout = () => {
    signOut()
    navigate('/login')
  }

  if (perfilLoading) return null
  if (!perfilSlug) return <AccessDenied profileUnavailable />

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((name: string) => name[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : user?.email
      ? user.email.slice(0, 2).toUpperCase()
      : 'PM'

  const activeModulePath = modulePathFor(location.pathname)
  const isActive = (path: string) => path === activeModulePath

  const pageTitle =
    getSubstituicoesPageTitle(location.pathname, MUTATIONS_ENABLED) ??
    navigation.find((item) => item.path === activeModulePath)?.label ??
    'Gestão Comercial PMais'

  return (
    <>
      <Sidebar
        collapsible="icon"
        className="border-r border-slate-700/60 bg-slate-800 text-slate-100"
      >
        <SidebarHeader className="border-b border-slate-700/60 bg-slate-800 p-0">
          <Link
            to="/"
            className="flex items-center gap-3 overflow-hidden p-3.5 group-data-[collapsible=icon]:p-1"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md">
              <Building2 aria-hidden="true" className="h-5 w-5" />
            </span>
            <span className="min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="block truncate text-lg font-bold tracking-tight text-white">
                PMais Comercial
              </span>
              <span className="block truncate text-xs text-slate-400">Gestão Comercial</span>
            </span>
          </Link>
        </SidebarHeader>

        <SidebarContent className="bg-slate-800 p-2">
          <nav aria-label="Navegação principal">
            <SidebarMenu>
              {navigation.map((item) => {
                const active = isActive(item.path)
                const Icon = item.icon

                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                      className={cn(
                        'h-10 gap-3 px-3 text-sm font-medium',
                        active
                          ? '!bg-violet-600 font-semibold !text-white shadow-sm hover:!bg-violet-500 hover:!text-white'
                          : 'text-slate-300 hover:bg-slate-700/70 hover:text-white',
                      )}
                    >
                      <Link
                        to={item.path}
                        onClick={() => setOpenMobile(false)}
                        aria-current={active ? 'page' : undefined}
                      >
                        <Icon
                          aria-hidden="true"
                          className={cn(
                            'h-4 w-4 shrink-0',
                            active ? 'text-white' : 'text-slate-400',
                          )}
                        />
                        <span>{item.label}</span>
                        {active && (
                          <ChevronRight
                            aria-hidden="true"
                            className="ml-auto h-4 w-4 text-violet-200 group-data-[collapsible=icon]:hidden"
                          />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </nav>
        </SidebarContent>

        <SidebarFooter className="border-t border-slate-700/60 bg-slate-900/40 p-3 group-data-[collapsible=icon]:p-1.5">
          <div className="flex items-center justify-between gap-2 overflow-hidden">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="h-9 w-9 shrink-0 border border-violet-400/40 bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
                <AvatarFallback className="bg-gradient-to-br from-violet-600 to-indigo-600 text-xs font-bold text-white">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-semibold text-white">
                  {user?.name || 'Usuário'}
                </p>
                <p className="truncate text-xs text-slate-400">{perfilSlug || user?.email}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 group-data-[collapsible=icon]:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setChangePasswordOpen(true)}
                className="h-8 w-8 text-slate-400 hover:bg-slate-700/70 hover:text-violet-300"
                aria-label="Alterar minha senha"
                title="Alterar minha senha"
              >
                <KeyRound aria-hidden="true" className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-8 w-8 text-slate-400 hover:bg-slate-700/70 hover:text-rose-400"
                aria-label="Sair do sistema"
                title="Sair do sistema"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 bg-slate-50 font-sans text-slate-900">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger
              className="h-9 w-9 text-slate-700 hover:bg-slate-100"
              aria-label="Recolher ou expandir menu principal"
              title="Recolher ou expandir menu principal"
            />
            <h1 className="truncate text-xl font-bold tracking-tight text-slate-900">
              {pageTitle}
            </h1>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <Avatar className="h-8 w-8 bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
              <AvatarFallback className="bg-gradient-to-br from-violet-600 to-indigo-600 text-xs font-bold text-white">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <span className="max-w-[160px] truncate text-sm font-medium text-slate-800">
              {user?.name || 'Usuário'}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setChangePasswordOpen(true)}
              className="h-8 w-8 text-slate-500 hover:bg-violet-50 hover:text-violet-600"
              aria-label="Alterar minha senha"
              title="Alterar minha senha"
            >
              <KeyRound aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <ModuleTabs showSubstituicoes={podeVerSubstituicoes} showSystem={podeAdministrar} />

        <main id="conteudo-principal" className="mx-auto w-full max-w-7xl flex-1 p-4 lg:p-8">
          <Outlet />
        </main>

        <footer className="flex flex-col items-center justify-between gap-2 border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-500 sm:flex-row">
          <span>Gestão Comercial PMais &copy; {new Date().getFullYear()}</span>
          <span className="text-slate-400">Sistema de Gestão Comercial</span>
        </footer>
      </SidebarInset>

      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
        userId={user?.id || ''}
        requireOldPassword
        userName={user?.name}
      />
    </>
  )
}

export function Layout() {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  )
}

export default Layout
