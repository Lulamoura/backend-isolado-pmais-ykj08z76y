import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'

// ─────────────────────────────────────────────────────────────────────
// Cache de módulo — evita refetch do perfil quando o perfilId não muda
// ─────────────────────────────────────────────────────────────────────
let cachedPerfilId: string | null = null
let cachedSlug: string | null = null

export function useIsSuperAdmin() {
  const { user, isAuthenticated } = useAuth()
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [perfilSlug, setPerfilSlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setIsSuperAdmin(false)
      setPerfilSlug(null)
      setLoading(false)
      // Limpa cache quando não autenticado
      cachedPerfilId = null
      cachedSlug = null
      return
    }

    const perfilId = user.perfil_id
    if (!perfilId || typeof perfilId !== 'string') {
      setIsSuperAdmin(false)
      setPerfilSlug(null)
      setLoading(false)
      return
    }

    // Cache hit — perfilId inalterado e slug já resolvido
    if (cachedPerfilId === perfilId && cachedSlug !== null) {
      setIsSuperAdmin(cachedSlug === 'superadministrador')
      setPerfilSlug(cachedSlug)
      setLoading(false)
      return
    }

    setLoading(true)
    // O contexto autorizado é resolvido no backend. A leitura direta de users
    // com expand pode ser recusada pelas regras da coleção e jamais deve fazer
    // a interface liberar rotas com perfil nulo.
    pb.send('/backend/v1/my-permissions', { method: 'GET' })
      .then((record) => {
        const slug = typeof record?.perfil_slug === 'string' ? record.perfil_slug : null
        cachedPerfilId = perfilId
        cachedSlug = slug
        setIsSuperAdmin(slug === 'superadministrador')
        setPerfilSlug(slug)
      })
      .catch(() => {
        // Falha fechada: perfil ausente mantém todas as áreas protegidas bloqueadas.
        cachedPerfilId = null
        cachedSlug = null
        setIsSuperAdmin(false)
        setPerfilSlug(null)
      })
      .finally(() => setLoading(false))
  }, [isAuthenticated, user])

  return { isSuperAdmin, perfilSlug, loading }
}
