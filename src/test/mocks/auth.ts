import { vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────
// Mock do módulo @/hooks/use-is-superadmin.
// ─────────────────────────────────────────────────────────────────────

export const useIsSuperAdmin = vi.fn().mockReturnValue({
  isSuperAdmin: false,
  perfilSlug: 'operador-comercial',
  loading: false,
})

/** Sobrescreve o retorno de useIsSuperAdmin para um teste. */
export function mockUseIsSuperAdmin(result: {
  isSuperAdmin: boolean
  perfilSlug: string | null
  loading: boolean
}): void {
  useIsSuperAdmin.mockReturnValue(result)
}
