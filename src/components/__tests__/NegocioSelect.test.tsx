import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Mocks (registrados ANTES de importar o SUT) ─────────────────────
const getList = vi.hoisted(() => vi.fn().mockResolvedValue({ items: [], totalItems: 0 }))
const getOne = vi.hoisted(() => vi.fn().mockResolvedValue({ id: '1', titulo: 'Test' }))
const send = vi.hoisted(() => vi.fn().mockResolvedValue({ items: [], totalItems: 0 }))

vi.mock('@/lib/pocketbase/client', () => ({
  default: {
    send,
    collection: () => ({ getList, getOne }),
    authStore: {
      isValid: false,
      record: null,
      clear: vi.fn(),
      save: vi.fn(),
      onChange: vi.fn().mockReturnValue(() => {}),
    },
  },
}))

vi.mock('@/hooks/use-is-superadmin', () => ({
  useIsSuperAdmin: vi.fn().mockReturnValue({
    isSuperAdmin: false,
    perfilSlug: 'operador-comercial',
    loading: false,
  }),
}))

import {
  buildNegocioFilter,
  NEGOCIO_EXPAND,
  NEGOCIO_FIELDS,
  NEGOCIO_OPCOES_COBERTURA_PATH,
  NegocioSelect,
  negocioLabel,
} from '@/components/NegocioSelect'

beforeEach(() => {
  vi.clearAllMocks()
  getList.mockResolvedValue({ items: [], totalItems: 0 })
  getOne.mockResolvedValue({ id: '1', titulo: 'Test' })
  send.mockResolvedValue({ items: [], totalItems: 0 })
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('NegocioSelect', () => {
  it('verifica que a busca carrega campos suficientes para identificar o negócio', async () => {
    expect(NEGOCIO_FIELDS).toBe(
      'id,titulo,etapa,oe_numero,external_id,expand.empresa_id.nome,expand.contato_principal_id.nome',
    )
    expect(NEGOCIO_EXPAND).toBe('empresa_id,contato_principal_id')
  })

  it('verifica getList(1, 50, ...) — paginação 50', async () => {
    render(<NegocioSelect value={[]} onChange={() => {}} initialOpen />)
    await Promise.resolve()
    await Promise.resolve()
    const args = getList.mock.calls[0]
    expect(args[0]).toBe(1)
    expect(args[1]).toBe(50)
  })

  it('usa endpoint backend de opções humanas quando filtra cobertura por titular', async () => {
    render(
      <NegocioSelect value={[]} onChange={() => {}} titularId="titular123" onlyOpen initialOpen />,
    )
    await Promise.resolve()
    await Promise.resolve()
    expect(send).toHaveBeenCalledWith(
      NEGOCIO_OPCOES_COBERTURA_PATH,
      expect.objectContaining({
        method: 'GET',
        query: { titular_id: 'titular123', q: '' },
      }),
    )
    expect(getList).not.toHaveBeenCalled()
  })

  it('filtra por negócios abertos do titular quando solicitado', async () => {
    const filter = buildNegocioFilter('', 'titular123', true)
    expect(filter).toContain('responsavel_id="titular123"')
    expect(filter).toContain('inativo != true')
    expect(filter).toContain('status = ""')
    expect(filter).toContain('resultado = ""')
  })

  it('usa empresa, contato e ID como identificação principal quando o título é genérico', async () => {
    getOne.mockResolvedValue({
      id: 'neg-123',
      titulo: 'Proposta Qualificada',
      external_id: '4821',
      etapa: 'negociacao',
      expand: {
        empresa_id: { nome: 'Autonunes Chevrolet Prazeres' },
        contato_principal_id: { nome: 'Maria Cliente' },
      },
    })
    render(<NegocioSelect value={['neg-123']} onChange={() => {}} />)
    expect(
      await screen.findByText(
        'Autonunes Chevrolet Prazeres — Maria Cliente — ID 4821 — negociacao',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/^Proposta Qualificada/)).not.toBeInTheDocument()
  })

  it('não usa o id técnico do banco como ID humano do negócio', async () => {
    expect(
      negocioLabel({
        id: 'rt8y7pqe55dzvbk',
        titulo: 'Proposta Qualificada',
        external_id: '',
        oe_numero: '',
        expand: { empresa_id: { nome: 'Autonunes Chevrolet Prazeres' } },
      }).label,
    ).toBe('Autonunes Chevrolet Prazeres')
  })

  it('mantém a busca por empresa/contato no cliente para evitar filtro inválido no PocketBase', async () => {
    const filter = buildNegocioFilter('Autonunes', 'titular123', true)
    expect(filter).toContain('responsavel_id="titular123"')
    expect(filter).toContain('inativo != true')
    expect(filter).not.toContain('empresa_id.nome')
    expect(filter).not.toContain('contato_principal_id.nome')
    expect(filter).not.toContain('external_id~')
  })

  it('multi-seleção: badges aparecem para itens selecionados', async () => {
    getOne.mockResolvedValue({ id: 'n1', titulo: 'Negócio Alpha' })
    render(<NegocioSelect value={['n1']} onChange={() => {}} />)
    // O badge é renderizado com o título resolvido via getOne
    expect(await screen.findByText('Negócio Alpha')).toBeInTheDocument()
  })

  it('remoção: clicar no X remove o item', async () => {
    const user = userEvent.setup()
    getOne.mockResolvedValue({ id: 'n1', titulo: 'Negócio Alpha' })
    const onChange = vi.fn()
    render(<NegocioSelect value={['n1']} onChange={onChange} />)
    const removeBtn = await screen.findByRole('button', { name: /Remover Negócio Alpha/i })
    await user.click(removeBtn)
    expect(onChange).toHaveBeenCalledWith([])
  })
})
