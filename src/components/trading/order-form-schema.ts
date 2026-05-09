import { z } from 'zod'
import { v1Direction } from '@/lib/api/generated/models/v1Direction'

const decimal = z
  .string()
  .optional()
  .refine((v) => v === undefined || v === '' || /^[0-9]+(\.[0-9]+)?$/.test(v), 'Mora biti broj.')

// Spec p.53 fields. OrderType is *derived* from limit/stop presence
// (see lib/trading/order-type.ts) — the form never exposes it.
export const orderFormSchema = z.object({
  direction: z.union([z.literal(v1Direction.DIRECTION_BUY), z.literal(v1Direction.DIRECTION_SELL)]),
  quantity: z.string().regex(/^[1-9][0-9]*$/, 'Mora biti pozitivan ceo broj.'),
  limitPrice: decimal,
  stopPrice: decimal,
  allOrNone: z.boolean(),
  margin: z.boolean(),
  accountId: z.string().min(1, 'Izaberi račun.'),
})
export type OrderFormValues = z.infer<typeof orderFormSchema>
