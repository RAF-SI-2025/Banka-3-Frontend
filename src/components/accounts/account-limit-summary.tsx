// Inline panel that surfaces the spec-p.13 daily / monthly limits and
// how much of them the source account has already burned through. Read
// straight off v1Account fields the gateway already populates — never
// recompute on the FE (CLAUDE.md edge case "Limit info popover").
//
// Used on the payment + transfer forms below the source-account picker
// so a user can see at a glance whether the next charge will hit the
// limit before they even start typing the amount.

import type { v1Account } from '@/lib/api/generated/models/v1Account'
import { formatMoney, currencyLabel } from '@/lib/format'

type LimitRowProps = {
  label: string
  limit?: string
  spent?: string
  currency: string
}

// limitMath returns the absolute and percent-of-limit "spent" values
// for a single bucket (daily or monthly). When the limit is missing or
// zero we treat it as "no limit set" — the row collapses to dashes
// rather than rendering NaN%.
function limitMath(limit?: string, spent?: string) {
  const l = Number(limit ?? '')
  const s = Number(spent ?? '0')
  if (!Number.isFinite(l) || l <= 0) {
    return { unlimited: true, remaining: NaN, percent: 0 }
  }
  const remaining = Math.max(l - s, 0)
  const percent = Math.min(Math.max((s / l) * 100, 0), 100)
  return { unlimited: false, remaining, percent }
}

function LimitRow({ label, limit, spent, currency }: LimitRowProps) {
  const { unlimited, remaining, percent } = limitMath(limit, spent)
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {unlimited ? '— limit nije postavljen —' : formatMoney(String(remaining), currency) + ' preostalo'}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={
            'h-full rounded-full ' +
            (percent >= 90 ? 'bg-danger' : percent >= 70 ? 'bg-amber-500' : 'bg-emerald-500')
          }
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>Iskorišćeno: {formatMoney(spent ?? '0', currency)}</span>
        <span>Limit: {unlimited ? '∞' : formatMoney(limit, currency)}</span>
      </div>
    </div>
  )
}

export function AccountLimitSummary({ account }: { account: v1Account }) {
  const currency = currencyLabel(account.currency ?? '')
  return (
    <section
      aria-label="Limit po računu"
      data-testid="account-limit-summary"
      className="space-y-3 rounded-md border border-border bg-surface-muted p-3"
    >
      <LimitRow label="Dnevni limit" limit={account.dailyLimit} spent={account.dailySpent} currency={currency} />
      <LimitRow label="Mesečni limit" limit={account.monthlyLimit} spent={account.monthlySpent} currency={currency} />
    </section>
  )
}
