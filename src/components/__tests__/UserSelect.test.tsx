import { describe, expect, it } from 'vitest'

import { USUARIO_OPCOES_COMERCIAIS_PATH, UserSelect, escapeFilter } from '@/components/UserSelect'

describe('UserSelect', () => {
  it('expõe endpoint backend de opções comerciais para evitar listagem direta de users', () => {
    expect(USUARIO_OPCOES_COMERCIAIS_PATH).toBe('/backend/v1/usuarios/opcoes-comerciais')
    const source = UserSelect.toString()
    expect(source).toContain('USUARIO_OPCOES_COMERCIAIS_PATH')
    expect(source).toContain('.default.send')
    expect(source).not.toContain("collection('users')")
  })

  it('envia query q e exclude_id para o endpoint de opções', () => {
    const source = UserSelect.toString()
    expect(source).toContain('params.q = query.trim()')
    expect(source).toContain('params.exclude_id = excludeId')
  })

  it('preserva escapeFilter exportado para componentes que ainda montam filtros locais', () => {
    expect(escapeFilter('a"b\\c')).toBe('a\\"b\\\\c')
  })
})
