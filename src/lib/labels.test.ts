import { describe, expect, it } from 'vitest'
import {
  accountKindLabel,
  accountSubtypeLabel,
  accountStatusLabel,
  cardBrandLabel,
  cardStatusLabel,
  loanTypeLabel,
  loanStatusLabel,
  loanRequestStatusLabel,
  installmentStatusLabel,
  interestTypeLabel,
  employmentStatusLabel,
  txKindLabel,
  txStatusLabel,
  subtypesForKind,
} from './labels'
import { v1AccountKind } from './api/generated/models/v1AccountKind'
import { v1AccountSubtype } from './api/generated/models/v1AccountSubtype'
import { v1AccountStatus } from './api/generated/models/v1AccountStatus'
import { v1CardBrand } from './api/generated/models/v1CardBrand'
import { v1CardStatus } from './api/generated/models/v1CardStatus'
import { v1LoanType } from './api/generated/models/v1LoanType'
import { v1LoanStatus } from './api/generated/models/v1LoanStatus'
import { v1LoanRequestStatus } from './api/generated/models/v1LoanRequestStatus'
import { v1InstallmentStatus } from './api/generated/models/v1InstallmentStatus'
import { v1InterestType } from './api/generated/models/v1InterestType'
import { v1EmploymentStatus } from './api/generated/models/v1EmploymentStatus'
import { v1TransactionKind } from './api/generated/models/v1TransactionKind'
import { v1TransactionStatus } from './api/generated/models/v1TransactionStatus'

// A label table is "complete" when every enum value has a non-empty
// Serbian string. This catches the case where someone adds an enum
// value to the proto and forgets to extend the label map — TS as Record
// only catches missing keys, not stale stub values.
function expectComplete<T extends string>(name: string, enumObj: Record<string, T>, labels: Record<T, string>) {
  for (const v of Object.values(enumObj)) {
    const label = labels[v]
    if (typeof label !== 'string' || label.length === 0) {
      throw new Error(`${name}: missing or empty label for ${v}`)
    }
  }
}

describe('label tables are complete for every enum value', () => {
  it('accountKindLabel', () => expectComplete('accountKindLabel', v1AccountKind, accountKindLabel))
  it('accountSubtypeLabel', () => expectComplete('accountSubtypeLabel', v1AccountSubtype, accountSubtypeLabel))
  it('accountStatusLabel', () => expectComplete('accountStatusLabel', v1AccountStatus, accountStatusLabel))
  it('cardBrandLabel', () => expectComplete('cardBrandLabel', v1CardBrand, cardBrandLabel))
  it('cardStatusLabel', () => expectComplete('cardStatusLabel', v1CardStatus, cardStatusLabel))
  it('loanTypeLabel', () => expectComplete('loanTypeLabel', v1LoanType, loanTypeLabel))
  it('loanStatusLabel', () => expectComplete('loanStatusLabel', v1LoanStatus, loanStatusLabel))
  it('loanRequestStatusLabel', () =>
    expectComplete('loanRequestStatusLabel', v1LoanRequestStatus, loanRequestStatusLabel))
  it('installmentStatusLabel', () =>
    expectComplete('installmentStatusLabel', v1InstallmentStatus, installmentStatusLabel))
  it('interestTypeLabel', () => expectComplete('interestTypeLabel', v1InterestType, interestTypeLabel))
  it('employmentStatusLabel', () => expectComplete('employmentStatusLabel', v1EmploymentStatus, employmentStatusLabel))
  it('txKindLabel', () => expectComplete('txKindLabel', v1TransactionKind, txKindLabel))
  it('txStatusLabel', () => expectComplete('txStatusLabel', v1TransactionStatus, txStatusLabel))
})

describe('label spot-checks', () => {
  it('account kinds use spec wording', () => {
    expect(accountKindLabel[v1AccountKind.ACCOUNT_KIND_PERSONAL_CHECKING_RSD]).toMatch(/Lični tekući/)
    expect(accountKindLabel[v1AccountKind.ACCOUNT_KIND_BUSINESS_FX]).toMatch(/Poslovni devizni/)
  })

  it('loan types match the FE form options', () => {
    expect(loanTypeLabel[v1LoanType.LOAN_TYPE_CASH]).toBe('Gotovinski')
    expect(loanTypeLabel[v1LoanType.LOAN_TYPE_HOUSING]).toBe('Stambeni')
  })

  it('transaction status labels are user-facing Serbian', () => {
    expect(txStatusLabel[v1TransactionStatus.TRANSACTION_STATUS_REALIZED]).toBe('Realizovana')
    expect(txStatusLabel[v1TransactionStatus.TRANSACTION_STATUS_PROCESSING]).toBe('U obradi')
  })
})

describe('subtypesForKind pins the spec p.12 subtype-to-kind contract', () => {
  it('personal RSD allows STANDARD + the social variants', () => {
    const got = subtypesForKind(v1AccountKind.ACCOUNT_KIND_PERSONAL_CHECKING_RSD)
    expect(got).toContain(v1AccountSubtype.ACCOUNT_SUBTYPE_STANDARD)
    expect(got).toContain(v1AccountSubtype.ACCOUNT_SUBTYPE_SAVINGS)
    expect(got).toContain(v1AccountSubtype.ACCOUNT_SUBTYPE_PENSIONER)
    expect(got).toContain(v1AccountSubtype.ACCOUNT_SUBTYPE_YOUTH)
    expect(got).toContain(v1AccountSubtype.ACCOUNT_SUBTYPE_STUDENT)
    expect(got).toContain(v1AccountSubtype.ACCOUNT_SUBTYPE_UNEMPLOYED)
    // Business-only subtypes must not leak in.
    expect(got).not.toContain(v1AccountSubtype.ACCOUNT_SUBTYPE_DOO)
    expect(got).not.toContain(v1AccountSubtype.ACCOUNT_SUBTYPE_AD)
    expect(got).not.toContain(v1AccountSubtype.ACCOUNT_SUBTYPE_FOUNDATION)
    // The default for personal-RSD must be STANDARD (first option).
    expect(got[0]).toBe(v1AccountSubtype.ACCOUNT_SUBTYPE_STANDARD)
  })

  it('business RSD allows only the legal-entity forms', () => {
    const got = subtypesForKind(v1AccountKind.ACCOUNT_KIND_BUSINESS_CHECKING_RSD)
    expect(got).toEqual([
      v1AccountSubtype.ACCOUNT_SUBTYPE_DOO,
      v1AccountSubtype.ACCOUNT_SUBTYPE_AD,
      v1AccountSubtype.ACCOUNT_SUBTYPE_FOUNDATION,
    ])
  })

  it('FX + system kinds collapse to UNSPECIFIED (empty list → hide field)', () => {
    expect(subtypesForKind(v1AccountKind.ACCOUNT_KIND_PERSONAL_FX)).toEqual([])
    expect(subtypesForKind(v1AccountKind.ACCOUNT_KIND_BUSINESS_FX)).toEqual([])
    expect(subtypesForKind(v1AccountKind.ACCOUNT_KIND_SYSTEM)).toEqual([])
    expect(subtypesForKind(v1AccountKind.ACCOUNT_KIND_UNSPECIFIED)).toEqual([])
  })
})
