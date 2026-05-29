import { useEffect } from 'react'
import { resolveTheme, useThemeStore } from './store'

// Applies the current theme to the <html> element. Listens to OS-level
// scheme changes only when the user has chosen 'system'.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const resolved = resolveTheme(theme)
      root.classList.toggle('dark', resolved === 'dark')
      root.dataset.theme = resolved
    }
    apply()

    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  return <>{children}</>
}
