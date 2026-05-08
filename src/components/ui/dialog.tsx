// Minimal modal — no portal libraries. We only need it for confirm
// dialogs and small forms; consumers control open/close themselves.
import { type ReactNode, useEffect } from 'react'

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="border-b border-gray-200 px-5 py-3">
            <h3 className="text-base font-semibold">{title}</h3>
          </div>
        )}
        <div className="p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}
