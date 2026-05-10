import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listActuaries } from '@/lib/api/actuaries'
import { getEmployee } from '@/lib/api/employees'
import { keys } from '@/lib/query-keys'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export interface ActuaryPickerProps {
  value: string
  onChange: (employeeId: string) => void
  label?: string
  // data-cy stem; the input gets `${dataCy}-input`, options
  // `${dataCy}-option-<id>`, the clear button `${dataCy}-clear`.
  dataCy?: string
}

// ActuaryPicker is a typeahead bound to /v1/actuaries?nameQuery=...
// joined with /v1/employees/{id} for display names. Replaces the raw-
// UUID input on the order-list filter (FE-6 in the c3 audit).
export function ActuaryPicker({ value, onChange, label = 'Aktuar', dataCy = 'actuary-picker' }: ActuaryPickerProps) {
  const inputId = useId()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // 250ms debounce — short enough not to feel laggy on a deliberate
  // typeahead, long enough to skip a search per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])

  const enabledList = open && debounced.length >= 1
  const suggestions = useQuery({
    queryKey: keys.actuary.list({ nameQuery: debounced, pageSize: 20 }),
    queryFn: () => listActuaries({ nameQuery: debounced, pageSize: 20 }),
    enabled: enabledList,
  })

  // Resolve selected ID into a display name. Reuses the shared
  // employee detail cache, so jumping into /aktuari/$id keeps the
  // record warm.
  const selected = useQuery({
    queryKey: keys.employee.detail(value),
    queryFn: () => getEmployee(value),
    enabled: !!value,
  })

  // Hydrate display names for the suggestion rows. actuary_info has
  // no name column — same fan-out pattern as routes/aktuari/index.
  const ids = useMemo(
    () => (suggestions.data?.actuaries ?? []).map((a) => a.employeeId ?? '').filter(Boolean),
    [suggestions.data],
  )
  // Single-shot batched fetch via /v1/employees with nameQuery would
  // be ideal; backend doesn't support id-set IN, and per-row useQueries
  // here would explode the hook tree on every keystroke. Cheap path:
  // call getEmployee on click to fill the cache; render row by id +
  // role hint for now. Picks up the proper name as soon as the user
  // clicks (and on next render, since the cache is warm).
  void ids

  // Click-outside to close.
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const selectedName = selected.data
    ? `${selected.data.firstName} ${selected.data.lastName}`
    : value
      ? '…'
      : ''

  return (
    <div ref={wrapperRef} className="relative">
      <Label htmlFor={inputId}>{label}</Label>
      {value ? (
        <div
          className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm"
          data-cy={`${dataCy}-selected`}
        >
          <span className="truncate">{selectedName}</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            data-cy={`${dataCy}-clear`}
            onClick={() => {
              onChange('')
              setQuery('')
            }}
          >
            ×
          </Button>
        </div>
      ) : (
        <>
          <Input
            id={inputId}
            data-cy={`${dataCy}-input`}
            placeholder="Pretraga po imenu"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
          />
          {open && debounced.length >= 1 && (
            <div
              role="listbox"
              data-cy={`${dataCy}-list`}
              className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-surface shadow"
            >
              {suggestions.isLoading && (
                <div className="px-3 py-2 text-sm text-muted-foreground">Učitavanje…</div>
              )}
              {suggestions.isError && (
                <div className="px-3 py-2 text-sm text-danger">Greška pri pretrazi.</div>
              )}
              {suggestions.data && (suggestions.data.actuaries?.length ?? 0) === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">Nema rezultata.</div>
              )}
              {(suggestions.data?.actuaries ?? []).map((a) => (
                <PickerRow
                  key={a.employeeId}
                  employeeId={a.employeeId ?? ''}
                  dataCy={`${dataCy}-option-${a.employeeId}`}
                  onPick={(id) => {
                    onChange(id)
                    setOpen(false)
                    setQuery('')
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PickerRow({
  employeeId,
  dataCy,
  onPick,
}: {
  employeeId: string
  dataCy: string
  onPick: (id: string) => void
}) {
  const emp = useQuery({
    queryKey: keys.employee.detail(employeeId),
    queryFn: () => getEmployee(employeeId),
    enabled: !!employeeId,
  })
  const label = emp.data ? `${emp.data.firstName} ${emp.data.lastName}` : '…'
  const sub = emp.data?.email
  return (
    <button
      type="button"
      role="option"
      data-cy={dataCy}
      onClick={() => onPick(employeeId)}
      className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
    >
      <span>{label}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </button>
  )
}
