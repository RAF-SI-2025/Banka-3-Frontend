import { z } from 'zod'

// passwordSchema mirrors the spec p.10 password constraint and the
// server-side check in pkg/passwords/passwords.go: 8–32 chars, ≥2
// digits, ≥1 uppercase Latin letter, ≥1 lowercase Latin letter.
// Enforced client-side so users get an inline error instead of a
// 400 round-trip on submit.
export const passwordSchema = z
  .string()
  .min(8, 'Lozinka mora imati najmanje 8 karaktera')
  .max(32, 'Lozinka može imati najviše 32 karaktera')
  .refine((v) => (v.match(/\d/g) ?? []).length >= 2, 'Najmanje 2 cifre')
  .refine((v) => /[A-Z]/.test(v), 'Najmanje 1 veliko slovo')
  .refine((v) => /[a-z]/.test(v), 'Najmanje 1 malo slovo')
