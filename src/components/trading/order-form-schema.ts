import { z } from 'zod'
import { v1Direction } from '@/lib/api/generated/models/v1Direction'

// 1_000_000 contracts is well past anything a sane order would carry
// (the spec doesn't pin a number; this is a sanity stop). Keeps the
// approx-cost preview from overflowing into Infinity when someone
// pastes a hundred-digit string into the field.
export const QUANTITY_MAX = 1_000_000

const decimal = z
  .string()
  .optional()
  .refine((v) => v === undefined || v === '' || /^[0-9]+(\.[0-9]+)?$/.test(v), 'Mora biti broj.')
  // 0 isn't a valid limit/stop — a 0-cap order would be unfillable
  // forever. Also catches "0.00", "0.0", etc.
  .refine((v) => v === undefined || v === '' || Number(v) > 0, 'Mora biti veće od 0.')

// Spec p.53 fields. OrderType is *derived* from limit/stop presence
// (see lib/trading/order-type.ts) — the form never exposes it.
export const orderFormSchema = z.object({
  direction: z.union([z.literal(v1Direction.DIRECTION_BUY), z.literal(v1Direction.DIRECTION_SELL)]),
  quantity: z
    .string()
    .regex(/^[1-9][0-9]*$/, 'Mora biti pozitivan ceo broj.')
    .refine((v) => Number(v) <= QUANTITY_MAX, `Maksimalno ${QUANTITY_MAX} ugovora.`),
  limitPrice: decimal,
  stopPrice: decimal,
  allOrNone: z.boolean(),
  margin: z.boolean(),
  accountId: z.string().min(1, 'Izaberi račun.'),
})
export type OrderFormValues = z.infer<typeof orderFormSchema>
