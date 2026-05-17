/* eslint-disable react-refresh/only-export-components */
/**
 * Toast — a lightweight, zero-dependency notification system.
 *
 * Architecture:
 *   - A singleton event bus (toastBus) that components emit to.
 *   - <ToastProvider /> listens and renders stacked toasts.
 *   - toast.success/error/info/warning() are the public API.
 *
 * Place <ToastProvider /> once, near the root (e.g. in _authed.tsx or __root.tsx).
 *
 * Usage:
 *   import { toast } from '@/components/ui/toast'
 *   toast.success('Plaćanje izvršeno')
 *   toast.error('Greška pri plaćanju')
 *   toast.info('Likvidacija u toku')
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────

type ToastTone = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: string
  message: string
  tone: ToastTone
  duration: number // ms; 0 = sticky
}

type ToastHandler = (item: ToastItem) => void

// ─── Event bus ──────────────────────────────────────────────────────────────

const handlers = new Set<ToastHandler>()

function emit(item: Omit<ToastItem, 'id'>) {
  const full: ToastItem = { ...item, id: crypto.randomUUID() }
  handlers.forEach((h) => h(full))
}

// ─── Public API ─────────────────────────────────────────────────────────────

export const toast = {
  success: (message: string, duration = 4000) => emit({ message, tone: 'success', duration }),
  error:   (message: string, duration = 6000) => emit({ message, tone: 'error', duration }),
  info:    (message: string, duration = 4000) => emit({ message, tone: 'info', duration }),
  warning: (message: string, duration = 5000) => emit({ message, tone: 'warning', duration }),
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function ToastProvider() {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    const handler: ToastHandler = (item) => {
      setItems((prev) => [...prev.slice(-4), item]) // max 5
      if (item.duration > 0) {
        setTimeout(() => dismiss(item.id), item.duration)
      }
    }
    handlers.add(handler)
    return () => { handlers.delete(handler) }
  }, [dismiss])

  if (items.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
    >
      {items.map((item) => (
        <ToastItem key={item.id} item={item} onDismiss={dismiss} />
      ))}
    </div>
  )
}

// ─── Single toast ────────────────────────────────────────────────────────────

const toneStyles: Record<ToastTone, string> = {
  success: 'border-success-soft bg-success-soft text-success-soft-foreground',
  error:   'border-danger-soft bg-danger-soft text-danger-soft-foreground',
  info:    'border-primary-soft bg-primary-soft text-primary-soft-foreground',
  warning: 'border-warning-soft bg-warning-soft text-warning-soft-foreground',
}

const ToneIcon: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  error:   AlertCircle,
  info:    Info,
  warning: AlertTriangle,
}

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const elRef = useRef<HTMLDivElement>(null)

  // Entrance animation via CSS — mount with opacity-0 then flip class
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const Icon = ToneIcon[item.tone]

  return (
    <div
      ref={elRef}
      role="status"
      className={cn(
        'flex w-80 items-start gap-3 rounded-lg border px-4 py-3 shadow-elevated text-sm',
        'transition-all duration-200',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        toneStyles[item.tone],
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="flex-1 leading-snug">{item.message}</p>
      <button
        type="button"
        aria-label="Zatvori"
        onClick={() => onDismiss(item.id)}
        className="mt-0.5 shrink-0 rounded opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
