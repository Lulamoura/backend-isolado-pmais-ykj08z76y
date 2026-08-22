import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('NegocioSelect', () => {
  it("verifica que pb.collection('com_negocios').getList é chamado com fields: 'id,titulo'", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<NegocioSelect value={[]} onChange={() => {}} />)
    await user.click(screen.getByRole('combobox', { name: 'Selecionar negócios' }))
    await vi.advanceTimersByTimeAsync(350)
    await waitFor(() => {
      expect(getList).toHaveBeenCalled()
    })
    const opts = getList.mock.calls[0][2] as Record<string, unknown>
    expect(opts.fields).toBe('id,titulo')
  })

  it('verifica getList(1, 20, ...) — paginação 20', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<NegocioSelect value={[]} onChange={() => {}} />)
    await user.click(screen.getByRole('combobox', { name: 'Selecionar negócios' }))
    await vi.advanceTimersByTimeAsync(350)
    await waitFor(() => {
      expect(getList).toHaveBeenCalled()
    })
    const args = getList.mock.calls[0]
    expect(args[0]).toBe(1)
    expect(args[1]).toBe(20)
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

  it('estado de loading: indicador visível', async () => {
    getList.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<NegocioSelect value={[]} onChange={() => {}} />)
    await user.click(screen.getByRole('combobox', { name: 'Selecionar negócios' }))
    await vi.advanceTimersByTimeAsync(350)
    expect(await screen.findByText('Buscando...')).toBeInTheDocument()
  })

  it('estado vazio/erro: mensagem apropriada', async () => {
    getList.mockResolvedValue({ items: [], totalItems: 0 })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<NegocioSelect value={[]} onChange={() => {}} />)
    await user.click(screen.getByRole('combobox', { name: 'Selecionar negócios' }))
    await vi.advanceTimersByTimeAsync(350)
    expect(await screen.findByText('Nenhum negócio encontrado')).toBeInTheDocument()
  })
})
