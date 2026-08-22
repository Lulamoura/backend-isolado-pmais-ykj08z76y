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
    // Releitura autenticada do próprio usuário — slug vem exclusivamente do
    // expand de perfil_id. Nunca lemos com_perfis diretamente (retorna 403
    // para todos exceto SA direto) nem aceitamos slug de campo não expandido.
    pb.collection('users')
      .getOne(user.id, { expand: 'perfil_id' })
      .then((record) => {
        const slug = record?.expand?.perfil_id?.slug ?? null
        cachedPerfilId = perfilId
        cachedSlug = slug
        setIsSuperAdmin(slug === 'superadministrador')
        setPerfilSlug(slug)
      })
      .catch(() => {
        // Limpa cache em caso de erro
        cachedPerfilId = null
        cachedSlug = null
        setIsSuperAdmin(false)
        setPerfilSlug(null)
      })
      .finally(() => setLoading(false))
  }, [isAuthenticated, user])

  return { isSuperAdmin, perfilSlug, loading }
}
