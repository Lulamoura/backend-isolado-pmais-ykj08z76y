/**
 * Gate C3C — bloqueio de mutações antes da validação operacional.
 *
 * VITE_ENABLE_MUTATIONS === 'true' somente em deploy separado
 * pós-C3C runtime aprovado + autorização PMais.
 * Ausente → undefined → undefined === 'true' → false (bloqueado).
 */
export const MUTATIONS_ENABLED: boolean = import.meta.env.VITE_ENABLE_MUTATIONS === 'true'

export class MutationsDisabledError extends Error {
  public readonly endpoint: string

  constructor(endpoint: string) {
    super(`MUTATIONS_DISABLED: ${endpoint}`)
    this.name = 'MutationsDisabledError'
    this.endpoint = endpoint
  }
}

/** Bloqueia chamada mutante se gate fechado. Zero tráfego de rede. */
export function assertMutationsEnabled(endpoint: string): void {
  if (!MUTATIONS_ENABLED) {
    throw new MutationsDisabledError(endpoint)
  }
}
