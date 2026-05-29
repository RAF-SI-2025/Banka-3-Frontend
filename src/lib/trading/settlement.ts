// Date-only "is settlement on/before today" check shared by OrderForm,
// ExerciseOptionDialog, and the supervisor order list.
//
// Backend `ApproveOrder` and `CreateOrder` use the same on-or-before-
// today semantics (services/trading/internal/service/orders.go); this
// helper keeps the FE from drifting.

export function isSettlementPast(settlementDate: string | null | undefined): boolean {
  if (!settlementDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const sd = new Date(settlementDate)
  if (Number.isNaN(sd.getTime())) return false
  sd.setHours(0, 0, 0, 0)
  return sd.getTime() <= today.getTime()
}
