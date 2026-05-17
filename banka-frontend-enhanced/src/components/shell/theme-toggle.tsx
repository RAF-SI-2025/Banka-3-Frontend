import { useEffect, useRef, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useThemeStore, type Theme } from '@/lib/theme/store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const options: ReadonlyArray<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Svetla', icon: Sun },
  { value: 'dark', label: 'Tamna', icon: Moon },
  { value: 'system', label: 'Sistemska', icon: Monitor },
]

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  return (
    <div className="relative" ref={wrapper}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Promeni temu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-44 overflow-hidden rounded-md border border-border bg-surface p-1 text-sm shadow-elevated animate-scale-in"
        >
          {options.map((opt) => {
            const OptIcon = opt.icon
            const active = opt.value === theme
            return (
              <button
                key={opt.value}
                role="menuitemradio"
                aria-checked={active}
                type="button"
                onClick={() => {
                  setTheme(opt.value)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors',
                  active
                    ? 'bg-primary-soft text-primary-soft-foreground'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <OptIcon className="size-4" />
                <span>{opt.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
