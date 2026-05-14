import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RefreshIndicator } from './refresh-indicator'

describe('RefreshIndicator', () => {
  it('renders the formatted last-updated time and calls onRefresh', () => {
    const onRefresh = vi.fn()
    const at = new Date(2026, 4, 14, 9, 5, 30).getTime() // local clock
    render(<RefreshIndicator updatedAt={at} isFetching={false} onRefresh={onRefresh} />)
    expect(screen.getByTestId('last-updated')).toHaveTextContent('09:05:30')
    fireEvent.click(screen.getByRole('button', { name: /Osveži/i }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('renders a dash when updatedAt is 0', () => {
    render(<RefreshIndicator updatedAt={0} isFetching={false} onRefresh={() => {}} />)
    expect(screen.getByTestId('last-updated')).toHaveTextContent('—')
  })
})
