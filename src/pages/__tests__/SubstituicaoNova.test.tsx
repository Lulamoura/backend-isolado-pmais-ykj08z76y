import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ─────────────────────────────────────────────────────────────────────
// Isolamento — todos os mocks declarados ANTES de qualquer import do SUT.
//
// 1) Mock do módulo PocketBase ANTES do SUT, reaproveitando o mock
//    existente em src/test/mocks/pocketbase.ts (factory async).
// ─────────────────────────────────────────────────────────────────────
vi.mock('@/lib/pocketbase/client', async () => {
  const mod = await import('@/test/mocks/pocketbase')
  return { default: mod.default }
})

// 2) Gate de feature-flags — MUTATIONS_ENABLED controlado via vi.hoisted.
//    assertMutationsEnabled é substituído por no-op: o serviço criador
//    (criarSubstituicao) importa-o por nome e recebe a versão mockada,
//    alcançando pb.send (alvo da asserção) com o gate aberto.
const ffState = vi.hoisted(() => ({ MUTATIONS_ENABLED: true }))
vi.mock('@/lib/feature-flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/feature-flags')>()
  return {
    ...actual,
    MUTATIONS_ENABLED: ffState.MUTATIONS_ENABLED,
    assertMutationsEnabled: vi.fn(),
  }
})

// 3) Mock de react-router-dom. Inlinado (src/test/mocks/router.ts contém
//    JSX num arquivo .ts, o que o oxlint/tsc tratam como erro de parse).
const _useNavigate = vi.hoisted(() => vi.fn().mockReturnValue(vi.fn()))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  const React = await import('react')
  const LinkStub = React.forwardRef<HTMLAnchorElement, { to?: string; children?: React.ReactNode }>(
    ({ to, children }, ref) => React.createElement('a', { href: to ?? '#', ref }, children),
  )
  LinkStub.displayName = 'LinkStub'
  return {
    ...actual,
    useNavigate: _useNavigate,
    Link: LinkStub,
  }
})

// UUID determinístico para creation_idempotency_key.
const IDEMPOTENCY_UUID = 'idempotency-key-001'

// Fixtures sintéticas de usuários — zero rede real.
const USERS = [
  { id: 'titular-001', name: 'Titular Fixtura' },
  { id: 'principal-001', name: 'Principal Fixtura' },
  { id: 'reserva-001', name: 'Reserva Fixtura' },
]

// Imports pós-mock.
import { MUTATIONS_ENABLED } from '@/lib/feature-flags'
import { pbSend, mockPbSend, mockCollectionGetList } from '@/test/mocks/pocketbase'
import SubstituicaoNova from '@/pages/SubstituicaoNova'

// ─────────────────────────────────────────────────────────────────────
// Helpers de interação com a UI real (UserSelect cmdk, Calendar, Select).
// ─────────────────────────────────────────────────────────────────────
type User = ReturnType<typeof userEvent.setup>

async function setupUser() {
  return userEvent.setup({
    advanceTimers: vi.advanceTimersByTime,
    pointerEventsCheck: 0,
  })
}

async function selectUserOption(user: User, triggerText: string, itemName: string) {
  await user.click(screen.getByText(triggerText))
  // Debounce de 300ms do UserSelect — avanço os timers falsos e microtasks.
  await vi.advanceTimersByTimeAsync(350)
  const item = await screen.findByText(itemName)
  await user.click(item)
}

async function selectCalendarDay(user: User, triggerText: string, dayNum: number) {
  await user.click(screen.getByRole('button', { name: triggerText }))
  // Flush de microtasks/timers do Popover (Radix) antes de ler o Calendar.
  await vi.advanceTimersByTimeAsync(0)
  // Botão de dia do Calendar (react-day-picker) — localiza por texto exato
  // para ser robusto ao aria-label que pode conter a data por extenso.
  const candidates = Array.from(document.querySelectorAll('button')).filter(
    (b) => (b.textContent ?? '').trim() === String(dayNum),
  )
  if (candidates.length === 0) {
    throw new Error(`Botão de dia ${dayNum} não encontrado no calendário`)
  }
  await user.click(candidates[0])
}

async function selectTipoCobertura(user: User, label: string) {
  // Trigger do Radix Select mostra o valor atual ("Integral").
  await user.click(screen.getByText('Integral'))
  await vi.advanceTimersByTimeAsync(0)
  const opt = await screen.findByRole('option', { name: label })
  await user.click(opt)
}

describe('SubstituicaoNova', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2025-01-05T12:00:00Z'))
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue(IDEMPOTENCY_UUID),
    })
    ffState.MUTATIONS_ENABLED = true
    mockCollectionGetList({ items: USERS, totalItems: USERS.length })
    mockPbSend({ id: 'sub-001' })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('idempotência — crypto.randomUUID() usado para creation_idempotency_key ao criar', async () => {
    // Gate aberto.
    expect(MUTATIONS_ENABLED).toBe(true)
    const user = await setupUser()
    render(<SubstituicaoNova />)

    // Formulário mínimo válido: titular + período (cobertura integral, sem principal).
    await selectUserOption(user, 'Selecionar titular', 'Titular Fixtura')
    await selectCalendarDay(user, 'Selecionar data início', 12)
    await selectCalendarDay(user, 'Selecionar data fim', 22)

    // Submeter → abre dialog de confirmação.
    await user.click(screen.getByRole('button', { name: /Criar substituição/ }))
    await vi.advanceTimersByTimeAsync(0)
    await user.click(await screen.findByRole('button', { name: 'Confirmar' }))

    // pb.send chamado com creation_idempotency_key determinístico.
    await waitFor(() => {
      expect(pbSend).toHaveBeenCalledWith(
        '/backend/v1/substituicoes/criar',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    const call = pbSend.mock.calls.find((c) => c[0] === '/backend/v1/substituicoes/criar')
    expect(call).toBeDefined()
    const body = JSON.parse((call![1] as { body: string }).body)
    expect(body.creation_idempotency_key).toBe(IDEMPOTENCY_UUID)
  })

  it('invariante I3 — reserva sem principal bloqueia submit', async () => {
    const user = await setupUser()
    render(<SubstituicaoNova />)

    // Apenas reserva selecionado (sem principal).
    await selectUserOption(user, 'Selecionar substituto reserva', 'Reserva Fixtura')

    await user.click(screen.getByRole('button', { name: /Criar substituição/ }))

    // Submit bloqueado: pb.send não chamado e mensagem de validação exibida.
    expect(pbSend).not.toHaveBeenCalled()
    expect(
      await screen.findByText('Substituto reserva exige um substituto principal.'),
    ).toBeInTheDocument()
  })

  it('invariante I4 — por_negocios sem principal bloqueia submit', async () => {
    const user = await setupUser()
    render(<SubstituicaoNova />)

    // Tipo de cobertura → "Por negócios" (sem substituto principal).
    await selectTipoCobertura(user, 'Por negócios')

    await user.click(screen.getByRole('button', { name: /Criar substituição/ }))

    // Submit bloqueado: pb.send não chamado e mensagem de validação exibida.
    expect(pbSend).not.toHaveBeenCalled()
    expect(
      await screen.findByText(
        'Sem substituto principal, a cobertura deve ser integral, sem reserva e sem negócios.',
      ),
    ).toBeInTheDocument()
  })
})
