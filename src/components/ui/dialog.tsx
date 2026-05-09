// Minimal modal — no portal libraries. We only need it for confirm
// dialogs and small forms; consumers control open/close themselves.
import { type ReactNode, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  panelClassName,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  panelClassName?: string
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className={cn(
          'w-full overflow-hidden rounded-lg border border-border bg-surface text-surface-foreground shadow-floating animate-scale-in',
          panelClassName ?? 'max-w-lg',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="border-b border-border px-5 py-3">
            <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          </div>
        )}
        <div className="p-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-border bg-surface-muted/60 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
