import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/lib/api/otc', () => ({
  listPublicHoldings: vi.fn(),
  listExternalPublicHoldings: vi.fn(),
  createExternalOTCOffer: vi.fn(),
}))
vi.mock('@/lib/api/accounts', () => ({ listAccounts: vi.fn() }))
vi.mock('@/lib/auth/store', () => ({
  useAuthStore: vi.fn((selector: (state: { userId: string }) => unknown) => selector({ userId: 'u-1' })),
}))
vi.mock('@/components/ui/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { listAccounts } from '@/lib/api/accounts'
import { listExternalPublicHoldings, listPublicHoldings, createExternalOTCOffer } from '@/lib/api/otc'
import { bankaBankV1Currency } from '@/lib/api/generated/models/bankaBankV1Currency'
import { bankaTradingV1Currency } from '@/lib/api/generated/models/bankaTradingV1Currency'
import { OTCDiscovery } from './OTCDiscovery'

function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('OTCDiscovery component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listPublicHoldings).mockResolvedValue({ items: [] })
    vi.mocked(listExternalPublicHoldings).mockResolvedValue({ items: [] })
    vi.mocked(createExternalOTCOffer).mockResolvedValue({ id: 'o-1', threadId: 't-1' })
    vi.mocked(listAccounts).mockResolvedValue({
      accounts: [
        {
          id: 'acc-1',
          number: '265000000000000001',
          name: 'Račun 1',
          currency: bankaBankV1Currency.CURRENCY_RSD,
          availableBalance: '1000.00',
        },
      ],
    })
  })

  it('renders external OTC rows and submits an external offer', async () => {
    vi.mocked(listPublicHoldings).mockResolvedValue({
      items: [
        {
          holdingId: 'local-1',
          sellerDisplayName: 'Local Seller',
          security: { ticker: 'AAPL', currency: bankaTradingV1Currency.CURRENCY_RSD },
          availableCount: 5,
          currentPrice: '100.00',
        },
      ],
    })
    vi.mocked(listExternalPublicHoldings).mockResolvedValue({
      items: [
        {
          holdingId: 'ext-1',
          sellerBankPrefix: '123',
          sellerDisplayName: 'External Seller',
          securityTicker: 'AAPL',
          availableCount: 10,
          currentPrice: '101.00',
          currency: 'CURRENCY_RSD',
        },
      ],
    })

    const { container } = renderWithQueryClient(<OTCDiscovery />)

    expect(await screen.findByText('Banka 123')).toBeTruthy()
    expect(screen.getByText('External Seller')).toBeTruthy()

    const externalOfferButton = container.querySelector('button[data-cy="otc-make-offer-ext-1"]')
    expect(externalOfferButton).toBeTruthy()
    fireEvent.click(externalOfferButton!)

    const heading = await screen.findByRole('heading', { name: /Ponuda za/ })
    expect(heading).toBeTruthy()
    expect(heading).toHaveTextContent(/Banka 123/)

    fireEvent.change(screen.getByLabelText(/Količina/i), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText(/Cena po akciji/i), { target: { value: '101.00' } })
    fireEvent.change(screen.getByLabelText(/Premija/i), { target: { value: '5.00' } })
    fireEvent.change(screen.getByLabelText(/Settlement datum/i), { target: { value: '2026-12-31' } })
    fireEvent.change(screen.getByLabelText(/Vaš račun/i), { target: { value: 'acc-1' } })

    fireEvent.click(screen.getByRole('button', { name: /Pošalji ponudu/i }))

    await waitFor(() => {
      expect(vi.mocked(createExternalOTCOffer)).toHaveBeenCalledWith(
        expect.objectContaining({
          sellerHoldingId: 'ext-1',
          sellerBankPrefix: '123',
          buyerAccountId: 'acc-1',
          quantity: 3,
          pricePerUnit: '101.00',
          premium: '5.00',
          settlementDate: '2026-12-31T00:00:00Z',
        }),
      )
    })

    await waitFor(() => expect(screen.queryByRole('heading', { name: /Ponuda za/ })).not.toBeInTheDocument())
  })
})
