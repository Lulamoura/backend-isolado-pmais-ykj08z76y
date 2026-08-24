import { describe, expect, it } from 'vitest'
import {
  actionStatus,
  ageInDays,
  filterAndSortCommercial,
  type CommercialContext,
} from '@/lib/commercial-context'

const context = (overrides: Partial<CommercialContext> = {}): CommercialContext => ({
  empresa: { id: 'e1', nome: 'Empresa Alfa' },
  contato: { id: 'c1', nome: 'Maria', email: null, telefone: null },
  responsavel: { id: 'u1', name: 'Vendedor 1' },
  valor_centavos: 10000,
  modalidade: 'recorrente',
  fase_crm: 'Negociação',
  fonte_prospeccao: 'Indicação',
  proxima_acao_em: '2026-08-24T12:00:00Z',
  crm_created_at: '2026-08-14T12:00:00Z',
  crm_updated_at: '2026-08-23T12:00:00Z',
  origem_canal: 'activecampaign',
  somente_leitura: true,
  ...overrides,
})

describe('contexto comercial', () => {
  it('classifica a próxima ação sem transformar ausência em pendência', () => {
    const now = new Date('2026-08-24T15:00:00Z')
    expect(actionStatus(null, now)).toBe('ausente')
    expect(actionStatus('2026-08-23T12:00:00Z', now)).toBe('vencida')
    expect(actionStatus('2026-08-24T12:00:00Z', now)).toBe('hoje')
    expect(actionStatus('2026-08-25T12:00:00Z', now)).toBe('futura')
  })

  it('calcula o tempo de vida a partir da criação no CRM', () => {
    expect(ageInDays('2026-08-14T12:00:00Z', new Date('2026-08-24T12:00:00Z'))).toBe(10)
  })

  it('filtra por empresa e ordena pelo maior valor', () => {
    const items = [
      { negocio: { titulo: 'A' }, contexto: context() },
      {
        negocio: { titulo: 'B' },
        contexto: context({ empresa: { id: 'e2', nome: 'Empresa Beta' }, valor_centavos: 50000 }),
      },
    ]
    expect(filterAndSortCommercial(items, 'beta', '', '', 'maior_valor')).toHaveLength(1)
    expect(filterAndSortCommercial(items, '', '', '', 'maior_valor')[0].negocio.titulo).toBe('B')
  })
})
