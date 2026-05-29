import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RouteErrorBoundary } from './error-boundary'

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: () => Promise.resolve(), navigate: () => Promise.resolve() }),
}))

function Boom(): never {
  throw new Error('render exploded')
}

describe('RouteErrorBoundary', () => {
  afterEach(() => cleanup())

  it('renders children when no error', () => {
    render(
      <RouteErrorBoundary>
        <div>healthy child</div>
      </RouteErrorBoundary>,
    )
    expect(screen.getByText('healthy child')).toBeTruthy()
  })

  it('catches render errors and shows the Serbian fallback', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <RouteErrorBoundary>
        <Boom />
      </RouteErrorBoundary>,
    )
    expect(screen.getByText('Greška u prikazu')).toBeTruthy()
    expect(screen.getByText('Pokušaj ponovo')).toBeTruthy()
    expect(screen.getByText('Početna')).toBeTruthy()
    spy.mockRestore()
  })

  it('clears the error when resetKey changes', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(
      <RouteErrorBoundary resetKey="/a">
        <Boom />
      </RouteErrorBoundary>,
    )
    expect(screen.getByText('Greška u prikazu')).toBeTruthy()
    rerender(
      <RouteErrorBoundary resetKey="/b">
        <div>recovered</div>
      </RouteErrorBoundary>,
    )
    expect(screen.getByText('recovered')).toBeTruthy()
    spy.mockRestore()
  })
})
