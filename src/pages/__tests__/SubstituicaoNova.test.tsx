import { describe, expect, it } from 'vitest'

import { criarSubstituicao } from '@/services/substituicoes'

describe('SubstituicaoNova contract', () => {
  it('serviço de criação usa a rota v2 de substituições', async () => {
    const source = criarSubstituicao.toString()
    expect(source).toContain('/backend/v1/substituicoes/criar-v2')
  })

  it('contrato do formulário mantém campos necessários para cobertura por negócios', async () => {
    const source = criarSubstituicao.toString()
    expect(source).toContain('assertMutationsEnabled')
    expect(source).toContain('JSON.stringify(payload)')
  })
})
