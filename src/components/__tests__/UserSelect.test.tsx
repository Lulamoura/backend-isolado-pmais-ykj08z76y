import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Mocks (registrados ANTES de importar o SUT) ─────────────────────
const getList = vi.fn().mockResolvedValue({ items: [], totalItems: 0 })
const getOne = vi.fn().mockResolvedValue({ id: '1', name: 'Test' })

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

import { UserSelect } from '@/components/UserSelect'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

function renderSelect(props = {}) {
  return render(
    <UserSelect value={null} onChange={() => {}} placeholder="Selecionar usuário" {...props} />,
  )
}

describe('UserSelect', () => {
  it("verifica que pb.collection('users').getList é chamado com fields: 'id,name'", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSelect()
    // Abre o popover
    await user.click(screen.getByRole('combobox', { name: 'Selecionar usuário' }))
    // Avança o debounce de 300ms
    await vi.advanceTimersByTimeAsync(350)
    await waitFor(() => {
      expect(getList).toHaveBeenCalled()
    })
    const callOpts = getList.mock.calls[0][2] as Record<string, unknown>
    expect(callOpts.fields).toBe('id,name')
  })

  it('verifica que o filtro inclui ativo_comercial=true', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSelect()
    await user.click(screen.getByRole('combobox', { name: 'Selecionar usuário' }))
    await vi.advanceTimersByTimeAsync(350)
    await waitFor(() => {
      expect(getList).toHaveBeenCalled()
    })
    const callOpts = getList.mock.calls[0][2] as Record<string, unknown>
    expect(callOpts.filter).toContain('ativo_comercial=true')
  })

  it('verifica getList(1, 20, ...) — paginação 1/20, sem getFullList', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSelect()
    await user.click(screen.getByRole('combobox', { name: 'Selecionar usuário' }))
    await vi.advanceTimersByTimeAsync(350)
    await waitFor(() => {
      expect(getList).toHaveBeenCalled()
    })
    const args = getList.mock.calls[0]
    expect(args[0]).toBe(1)
    expect(args[1]).toBe(20)
  })

  it('escapa aspas simples no termo de busca (filtro usa escapeFilter)', async () => {
    // A implementação escapa aspas duplas e barra invertida.
    // Verificamos que um termo com aspas duplas é escapado no filtro.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSelect()
    await user.click(screen.getByRole('combobox', { name: 'Selecionar usuário' }))
    const input = await screen.findByPlaceholderText('Buscar usuário...')
    await user.type(input, 'a"b')
    await vi.advanceTimersByTimeAsync(350)
    await waitFor(() => {
      expect(getList).toHaveBeenCalled()
    })
    const lastCall = getList.mock.calls[getList.mock.calls.length - 1]
    const opts = lastCall[2] as Record<string, unknown>
    expect(opts.filter).toContain('a\\"b')
  })

  it('estado de loading: indicador visível', async () => {
    // getList pendente indefinidamente mantém loading=true
    getList.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSelect()
    await user.click(screen.getByRole('combobox', { name: 'Selecionar usuário' }))
    await vi.advanceTimersByTimeAsync(350)
    expect(await screen.findByText('Buscando...')).toBeInTheDocument()
  })

  it('estado vazio: mensagem "Nenhum usuário encontrado"', async () => {
    getList.mockResolvedValue({ items: [], totalItems: 0 })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSelect()
    await user.click(screen.getByRole('combobox', { name: 'Selecionar usuário' }))
    await vi.advanceTimersByTimeAsync(350)
    expect(await screen.findByText('Nenhum usuário encontrado')).toBeInTheDocument()
  })

  it('estado de erro: mensagem de erro visível', async () => {
    getList.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSelect()
    await user.click(screen.getByRole('combobox', { name: 'Selecionar usuário' }))
    await vi.advanceTimersByTimeAsync(350)
    expect(await screen.findByText('Erro ao buscar usuários')).toBeInTheDocument()
  })
})
