import { vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────
// Mocks para react-router-dom usados pelos testes de componentes/páginas.
// ─────────────────────────────────────────────────────────────────────

export const useNavigate = vi.fn().mockReturnValue(vi.fn())

export const useParams = vi.fn().mockReturnValue({})

export const useSearchParams = vi.fn().mockReturnValue([new URLSearchParams(), vi.fn()])

export const useLocation = vi
  .fn()
  .mockReturnValue({ pathname: '/', search: '', hash: '', state: null })

export function Link({
  to,
  children,
  ...rest
}: {
  to?: string
  children?: React.ReactNode
  [k: string]: unknown
}) {
  return (
    <a href={to ?? '#'} {...rest}>
      {children}
    </a>
  )
}

/** Sobrescreve o retorno de useParams para um teste. */
export function mockUseParams(params: Record<string, string | undefined>): void {
  useParams.mockReturnValue(params)
}

/** Retorna o mock de useNavigate para inspecionar chamadas. */
export function getNavigateMock(): ReturnType<typeof vi.fn> {
  return useNavigate.getMockImplementation()?.() as ReturnType<typeof vi.fn>
}
