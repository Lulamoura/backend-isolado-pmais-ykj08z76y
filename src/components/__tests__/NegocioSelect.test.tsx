import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Mocks (registrados ANTES de importar o SUT) ─────────────────────
const getList = vi.fn().mockResolvedValue({ items: [], totalItems: 0 })
const getOne = vi.fn().mockResolvedValue({ id: '1', titulo: 'Test' })

vi.mock('@/lib/pocketbase/client', () => ({
  default: {
    send: vi.fn(),
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

import { NegocioSelect } from '@/components/NegocioSelect'

beforeEach(() => {
  vi.clearAllMocks()
  getList.mockResolvedValue({ items: [], totalItems: 0 })
  getOne.mockResolvedValue({ id: '1', titulo: 'Test' })
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('NegocioSelect', () => {
  it('verifica que a busca carrega campos suficientes para identificar o negócio', async () => {
    render(<NegocioSelect value={[]} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('combobox', { name: 'Selecionar negócios' }))
    await waitFor(() => {
      expect(getList).toHaveBeenCalled()
    })
    const opts = getList.mock.calls[0][2] as Record<string, unknown>
    expect(opts.fields).toBe('id,titulo,etapa,oe_numero,expand.empresa_id.nome')
    expect(opts.expand).toBe('empresa_id')
  })

  it('verifica getList(1, 50, ...) — paginação 50', async () => {
    render(<NegocioSelect value={[]} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('combobox', { name: 'Selecionar negócios' }))
    await waitFor(() => {
      expect(getList).toHaveBeenCalled()
    })
    const args = getList.mock.calls[0]
    expect(args[0]).toBe(1)
    expect(args[1]).toBe(50)
  })

  it('filtra por negócios abertos do titular quando solicitado', async () => {
    render(<NegocioSelect value={[]} onChange={() => {}} titularId="titular123" onlyOpen />)
    fireEvent.click(screen.getByRole('combobox', { name: 'Selecionar negócios' }))
    await waitFor(() => expect(getList).toHaveBeenCalled())

    const opts = getList.mock.calls[0][2] as Record<string, string>
    expect(opts.filter).toContain('responsavel_id="titular123"')
    expect(opts.filter).toContain('inativo != true')
    expect(opts.filter).toContain('status = ""')
    expect(opts.filter).toContain('resultado = ""')
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
