import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getFirstListItem = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ valor: 'https://crm.example.com/app/deals/' }),
)

vi.mock('@/lib/pocketbase/client', () => ({
  default: {
    collection: () => ({ getFirstListItem }),
  },
}))

import { ActiveCampaignDealLink } from '@/components/ActiveCampaignDealLink'

describe('ActiveCampaignDealLink', () => {
  beforeEach(() => {
    getFirstListItem.mockClear()
  })

  it('compartilha somente a leitura em andamento entre vários cartões', async () => {
    let resolverPrimeiraLeitura!: (record: { valor: string }) => void
    const primeiraLeitura = new Promise<{ valor: string }>((resolve) => {
      resolverPrimeiraLeitura = resolve
    })
    getFirstListItem.mockReturnValueOnce(primeiraLeitura)

    const primeiraTela = render(
      <>
        <ActiveCampaignDealLink dealId="4887" />
        <ActiveCampaignDealLink dealId="4883" />
        <ActiveCampaignDealLink dealId="4879" />
      </>,
    )

    await waitFor(() => expect(getFirstListItem).toHaveBeenCalledTimes(1))
    await act(async () => {
      resolverPrimeiraLeitura({ valor: 'https://crm.example.com/app/deals/' })
      await primeiraLeitura
    })

    expect(screen.getByRole('link', { name: /4887/ })).toHaveAttribute(
      'href',
      'https://crm.example.com/app/deals/4887',
    )
    expect(screen.getByRole('link', { name: /4883/ })).toHaveAttribute(
      'href',
      'https://crm.example.com/app/deals/4883',
    )
    expect(screen.getByRole('link', { name: /4879/ })).toHaveAttribute(
      'href',
      'https://crm.example.com/app/deals/4879',
    )

    primeiraTela.unmount()
    getFirstListItem.mockResolvedValueOnce({ valor: 'https://crm-novo.example.com/app/deals' })

    const segundaTela = render(<ActiveCampaignDealLink dealId="4900" />)

    await waitFor(() => expect(getFirstListItem).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /4900/ })).toHaveAttribute(
        'href',
        'https://crm-novo.example.com/app/deals/4900',
      ),
    )

    segundaTela.unmount()
    let rejeitarLeitura!: (error: Error) => void
    const leituraComFalha = new Promise<{ valor: string }>((_, reject) => {
      rejeitarLeitura = reject
    })
    getFirstListItem.mockReturnValueOnce(leituraComFalha)

    const telaComFalha = render(<ActiveCampaignDealLink dealId="4901" />)
    await waitFor(() => expect(getFirstListItem).toHaveBeenCalledTimes(3))
    await act(async () => {
      rejeitarLeitura(new Error('falha temporária'))
      await leituraComFalha.catch(() => undefined)
    })
    telaComFalha.unmount()

    getFirstListItem.mockResolvedValueOnce({ valor: 'https://crm-recuperado.example.com/deals/' })
    render(<ActiveCampaignDealLink dealId="4902" />)

    await waitFor(() => expect(getFirstListItem).toHaveBeenCalledTimes(4))
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /4902/ })).toHaveAttribute(
        'href',
        'https://crm-recuperado.example.com/deals/4902',
      ),
    )
  })
})
