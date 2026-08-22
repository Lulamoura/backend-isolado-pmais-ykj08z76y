import { Link, useLocation } from 'react-router-dom'

import { ADMIN_TABS, PIPELINE_TABS, type NavigationEntry } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import { useIsSuperAdmin } from '@/hooks/use-is-superadmin'

interface ModuleTabsProps {
  showSubstituicoes: boolean
}

export function ModuleTabs({ showSubstituicoes }: ModuleTabsProps) {
  const location = useLocation()
  const { perfilSlug } = useIsSuperAdmin()
  let tabs: NavigationEntry[] = []
  let label = ''

  if (
    ['/pipeline', '/qualificacao', '/propostas', '/fechamentos', '/ordens-execucao'].some(
      (path) => location.pathname === path || location.pathname.startsWith(`${path}/`),
    )
  ) {
    tabs =
      perfilSlug === 'negociacao-propria'
        ? PIPELINE_TABS.filter((item) =>
            ['/pipeline', '/propostas', '/fechamentos'].includes(item.path),
          )
        : PIPELINE_TABS
    label = 'Etapas do Pipeline Comercial'
  } else if (
    ['/foundation', '/slas', '/substituicoes'].some(
      (path) => location.pathname === path || location.pathname.startsWith(`${path}/`),
    )
  ) {
    tabs = showSubstituicoes
      ? ADMIN_TABS
      : ADMIN_TABS.filter((item) => item.path !== '/substituicoes')
    label = 'Áreas da Administração'
  }

  if (!tabs.length) return null

  return (
    <nav aria-label={label} className="border-b border-slate-200 bg-white px-4 lg:px-8">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto py-2">
        {tabs.map((item) => {
          const active =
            location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
          const Icon = item.icon
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
              )}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
