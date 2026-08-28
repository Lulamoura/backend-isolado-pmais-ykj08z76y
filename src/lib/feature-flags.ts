/**
 * Gate exclusivo do módulo Substituições — liberado para homologação no Preview
 * antes do caso real de 31/08/2026, conforme piloto assistido autorizado pela PMais.
 */
export const MUTATIONS_ENABLED: boolean = true

export class MutationsDisabledError extends Error {
  public readonly endpoint: string

  constructor(endpoint: string) {
    super(`MUTATIONS_DISABLED: ${endpoint}`)
    this.name = 'MutationsDisabledError'
    this.endpoint = endpoint
  }
}

/** Bloqueia chamada mutante se gate fechado. Zero tráfego de rede. */
export function assertMutationsEnabled(
  endpoint: string,
  enabled: boolean = MUTATIONS_ENABLED,
): void {
  if (!enabled) {
    throw new MutationsDisabledError(endpoint)
  }
}
