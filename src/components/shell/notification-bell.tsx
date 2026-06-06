import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from '@/lib/api/notifications'
import { keys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'

const LIST_ARGS = { page: 1, pageSize: 20 } as const

// NotificationBell renders the in-app notification feed (todoSpec S19):
// a bell with an unread badge and a click-to-open panel. It polls every
// 30s so the badge updates without a reload, and marks an item read on
// click. Hand-rolled popover — the project has no Radix/Popover.
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: keys.notification.list(LIST_ARGS),
    queryFn: () => listNotifications(LIST_ARGS),
    refetchInterval: 30_000,
    staleTime: 0,
  })

  const unread = Number(data?.unread ?? 0)
  const items = data?.items ?? []

  const markOne = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notification.all }),
  })
  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notification.all }),
  })

  // Close on outside-click + Escape.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Obaveštenja"
        className="relative grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-danger-foreground">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-soft">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">Obaveštenja</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
              >
                <CheckCheck className="size-3.5" />
                Označi sve kao pročitano
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nemate obaveštenja.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    onClick={() => {
                      if (!n.read) markOne.mutate(n.id)
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationRow({ n, onClick }: { n: Notification; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-muted',
          !n.read && 'bg-primary-soft/40',
        )}
      >
        <div className="flex items-center gap-2">
          {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
          <span className={cn('text-sm', !n.read ? 'font-semibold' : 'font-medium')}>
            {n.title}
          </span>
        </div>
        <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
        <span className="text-[11px] text-muted-foreground">{formatWhen(n.createdAt)}</span>
      </button>
    </li>
  )
}

// formatWhen renders the timestamp as DD.MM.YYYY HH:mm (spec display
// convention). Falls back to the raw string if it doesn't parse.
function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}. ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
