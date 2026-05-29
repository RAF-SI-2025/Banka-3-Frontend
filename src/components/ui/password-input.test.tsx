import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PasswordInput } from './password-input'

describe('PasswordInput', () => {
  it('starts in masked mode and toggles to plain text on click', () => {
    render(<PasswordInput aria-label="lozinka" defaultValue="tajna123" />)
    const field = screen.getByLabelText('lozinka') as HTMLInputElement
    expect(field.type).toBe('password')

    const toggle = screen.getByRole('button', { name: /Prikaži lozinku/i })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(toggle)
    expect(field.type).toBe('text')
    expect(screen.getByRole('button', { name: /Sakrij lozinku/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: /Sakrij lozinku/i }))
    expect(field.type).toBe('password')
  })

  it('forwards props to the underlying input', () => {
    render(<PasswordInput id="pwd" autoComplete="new-password" placeholder="lozinka" />)
    const field = screen.getByPlaceholderText('lozinka') as HTMLInputElement
    expect(field.id).toBe('pwd')
    expect(field.autocomplete).toBe('new-password')
  })
})
