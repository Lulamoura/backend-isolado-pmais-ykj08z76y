import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { getMyPermissions } from '@/services/permissions'

interface PermissionsContextType {
  permissions: Record<string, string>
  hasPermission: (slug: string) => boolean
  getScope: (slug: string) => string | null
  loading: boolean
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined)

export const usePermissions = () => {
  const context = useContext(PermissionsContext)
  if (!context) throw new Error('usePermissions must be used within a PermissionsProvider')
  return context
}

export const PermissionsProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const [permissions, setPermissions] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated || !user) {
      setPermissions({})
      setLoading(false)
      return
    }
    getMyPermissions()
      .then((data) => setPermissions(data.permissions || {}))
      .catch(() => setPermissions({}))
      .finally(() => setLoading(false))
  }, [isAuthenticated, user, authLoading])

  const hasPermission = (slug: string) => slug in permissions
  const getScope = (slug: string) => permissions[slug] || null

  return (
    <PermissionsContext.Provider value={{ permissions, hasPermission, getScope, loading }}>
      {children}
    </PermissionsContext.Provider>
  )
}
