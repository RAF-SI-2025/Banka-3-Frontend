import { z } from 'zod'

const numberRe = /^[0-9]+(\.[0-9]+)?$/

// Spec p.37 admin override of (price, ask, bid). Plain non-negative
// decimals; backend re-validates against business rules.
export const priceOverrideSchema = z.object({
  price: z.string().regex(numberRe, 'Mora biti broj.'),
  ask: z.string().regex(numberRe, 'Mora biti broj.'),
  bid: z.string().regex(numberRe, 'Mora biti broj.'),
})
export type PriceOverrideValues = z.infer<typeof priceOverrideSchema>
