// Human-readable Serbian labels for backend enums. Centralised here so
// the same strings appear everywhere (table cells, dropdowns, badges).

import { v1AccountKind } from './api/generated/models/v1AccountKind'
import { v1AccountSubtype } from './api/generated/models/v1AccountSubtype'
import { v1AccountStatus } from './api/generated/models/v1AccountStatus'
import { v1CardBrand } from './api/generated/models/v1CardBrand'
import { v1CardStatus } from './api/generated/models/v1CardStatus'
import { v1LoanType } from './api/generated/models/v1LoanType'
import { v1InterestType } from './api/generated/models/v1InterestType'
import { v1LoanStatus } from './api/generated/models/v1LoanStatus'
import { v1LoanRequestStatus } from './api/generated/models/v1LoanRequestStatus'
import { v1InstallmentStatus } from './api/generated/models/v1InstallmentStatus'
import { v1EmploymentStatus } from './api/generated/models/v1EmploymentStatus'
import { v1TransactionKind } from './api/generated/models/v1TransactionKind'
import { v1TransactionStatus } from './api/generated/models/v1TransactionStatus'

export const accountKindLabel: Record<v1AccountKind, string> = {
  [v1AccountKind.ACCOUNT_KIND_UNSPECIFIED]: '—',
  [v1AccountKind.ACCOUNT_KIND_PERSONAL_CHECKING_RSD]: 'Lični tekući RSD',
  [v1AccountKind.ACCOUNT_KIND_PERSONAL_FX]: 'Lični devizni',
  [v1AccountKind.ACCOUNT_KIND_BUSINESS_CHECKING_RSD]: 'Poslovni tekući',
  [v1AccountKind.ACCOUNT_KIND_BUSINESS_FX]: 'Poslovni devizni',
  [v1AccountKind.ACCOUNT_KIND_SYSTEM]: 'Sistemski (banka)',
}

export const accountSubtypeLabel: Record<v1AccountSubtype, string> = {
  [v1AccountSubtype.ACCOUNT_SUBTYPE_UNSPECIFIED]: '—',
  [v1AccountSubtype.ACCOUNT_SUBTYPE_STANDARD]: 'Standardni',
  [v1AccountSubtype.ACCOUNT_SUBTYPE_SAVINGS]: 'Štedni',
  [v1AccountSubtype.ACCOUNT_SUBTYPE_PENSIONER]: 'Penzionerski',
  [v1AccountSubtype.ACCOUNT_SUBTYPE_YOUTH]: 'Omladinski',
  [v1AccountSubtype.ACCOUNT_SUBTYPE_STUDENT]: 'Studentski',
  [v1AccountSubtype.ACCOUNT_SUBTYPE_UNEMPLOYED]: 'Za nezaposlene',
  [v1AccountSubtype.ACCOUNT_SUBTYPE_DOO]: 'DOO',
  [v1AccountSubtype.ACCOUNT_SUBTYPE_AD]: 'AD',
  [v1AccountSubtype.ACCOUNT_SUBTYPE_FOUNDATION]: 'Fondacija',
}

// subtypesForKind returns the AccountSubtype values that are valid for a
// given AccountKind, in display order. Encodes the spec-p.12 contract
// the backend (services/bank/internal/service/accounts.go) checks: only
// RSD checking accounts carry a subtype; FX + system accounts collapse
// to UNSPECIFIED. Personal-RSD allows STANDARD or any of the special
// social variants; Business-RSD takes one of three legal-entity forms.
//
// Returning an empty array signals "no subtype field — submit
// UNSPECIFIED" so the new-account form can hide the dropdown.
export function subtypesForKind(kind: v1AccountKind): v1AccountSubtype[] {
  switch (kind) {
    case v1AccountKind.ACCOUNT_KIND_PERSONAL_CHECKING_RSD:
      return [
        v1AccountSubtype.ACCOUNT_SUBTYPE_STANDARD,
        v1AccountSubtype.ACCOUNT_SUBTYPE_SAVINGS,
        v1AccountSubtype.ACCOUNT_SUBTYPE_PENSIONER,
        v1AccountSubtype.ACCOUNT_SUBTYPE_YOUTH,
        v1AccountSubtype.ACCOUNT_SUBTYPE_STUDENT,
        v1AccountSubtype.ACCOUNT_SUBTYPE_UNEMPLOYED,
      ]
    case v1AccountKind.ACCOUNT_KIND_BUSINESS_CHECKING_RSD:
      return [
        v1AccountSubtype.ACCOUNT_SUBTYPE_DOO,
        v1AccountSubtype.ACCOUNT_SUBTYPE_AD,
        v1AccountSubtype.ACCOUNT_SUBTYPE_FOUNDATION,
      ]
    default:
      return []
  }
}

export const accountStatusLabel: Record<v1AccountStatus, string> = {
  [v1AccountStatus.ACCOUNT_STATUS_UNSPECIFIED]: '—',
  [v1AccountStatus.ACCOUNT_STATUS_ACTIVE]: 'Aktivan',
  [v1AccountStatus.ACCOUNT_STATUS_INACTIVE]: 'Neaktivan',
}

export const cardBrandLabel: Record<v1CardBrand, string> = {
  [v1CardBrand.CARD_BRAND_UNSPECIFIED]: '—',
  [v1CardBrand.CARD_BRAND_VISA]: 'Visa',
  [v1CardBrand.CARD_BRAND_MASTERCARD]: 'Mastercard',
  [v1CardBrand.CARD_BRAND_DINACARD]: 'DinaCard',
  [v1CardBrand.CARD_BRAND_AMEX]: 'American Express',
}

export const cardStatusLabel: Record<v1CardStatus, string> = {
  [v1CardStatus.CARD_STATUS_UNSPECIFIED]: '—',
  [v1CardStatus.CARD_STATUS_ACTIVE]: 'Aktivna',
  [v1CardStatus.CARD_STATUS_BLOCKED]: 'Blokirana',
  [v1CardStatus.CARD_STATUS_DEACTIVATED]: 'Deaktivirana',
}

export const loanTypeLabel: Record<v1LoanType, string> = {
  [v1LoanType.LOAN_TYPE_UNSPECIFIED]: '—',
  [v1LoanType.LOAN_TYPE_CASH]: 'Gotovinski',
  [v1LoanType.LOAN_TYPE_HOUSING]: 'Stambeni',
  [v1LoanType.LOAN_TYPE_AUTO]: 'Auto',
  [v1LoanType.LOAN_TYPE_REFINANCE]: 'Refinansirajući',
  [v1LoanType.LOAN_TYPE_STUDENT]: 'Studentski',
}

export const interestTypeLabel: Record<v1InterestType, string> = {
  [v1InterestType.INTEREST_TYPE_UNSPECIFIED]: '—',
  [v1InterestType.INTEREST_TYPE_FIXED]: 'Fiksna',
  [v1InterestType.INTEREST_TYPE_VARIABLE]: 'Varijabilna',
}

export const loanStatusLabel: Record<v1LoanStatus, string> = {
  [v1LoanStatus.LOAN_STATUS_UNSPECIFIED]: '—',
  [v1LoanStatus.LOAN_STATUS_APPROVED]: 'Aktivan',
  [v1LoanStatus.LOAN_STATUS_REJECTED]: 'Odbijen',
  [v1LoanStatus.LOAN_STATUS_PAID_OFF]: 'Isplaćen',
  [v1LoanStatus.LOAN_STATUS_OVERDUE]: 'U kašnjenju',
}

export const loanRequestStatusLabel: Record<v1LoanRequestStatus, string> = {
  [v1LoanRequestStatus.LOAN_REQUEST_STATUS_UNSPECIFIED]: '—',
  [v1LoanRequestStatus.LOAN_REQUEST_STATUS_PENDING]: 'Na čekanju',
  [v1LoanRequestStatus.LOAN_REQUEST_STATUS_APPROVED]: 'Odobren',
  [v1LoanRequestStatus.LOAN_REQUEST_STATUS_REJECTED]: 'Odbijen',
}

export const installmentStatusLabel: Record<v1InstallmentStatus, string> = {
  [v1InstallmentStatus.INSTALLMENT_STATUS_UNSPECIFIED]: '—',
  [v1InstallmentStatus.INSTALLMENT_STATUS_PAID]: 'Plaćena',
  [v1InstallmentStatus.INSTALLMENT_STATUS_UNPAID]: 'Neplaćena',
  [v1InstallmentStatus.INSTALLMENT_STATUS_OVERDUE]: 'U kašnjenju',
}

export const employmentStatusLabel: Record<v1EmploymentStatus, string> = {
  [v1EmploymentStatus.EMPLOYMENT_STATUS_UNSPECIFIED]: '—',
  [v1EmploymentStatus.EMPLOYMENT_STATUS_PERMANENT]: 'Stalno zaposlen',
  [v1EmploymentStatus.EMPLOYMENT_STATUS_TEMPORARY]: 'Privremeno zaposlen',
  [v1EmploymentStatus.EMPLOYMENT_STATUS_UNEMPLOYED]: 'Nezaposlen',
}

export const txKindLabel: Record<v1TransactionKind, string> = {
  [v1TransactionKind.TRANSACTION_KIND_UNSPECIFIED]: '—',
  [v1TransactionKind.TRANSACTION_KIND_PAYMENT]: 'Plaćanje',
  [v1TransactionKind.TRANSACTION_KIND_TRANSFER]: 'Transfer',
  [v1TransactionKind.TRANSACTION_KIND_EXCHANGE]: 'Menjačnica',
  [v1TransactionKind.TRANSACTION_KIND_FEE]: 'Provizija',
}

export const txStatusLabel: Record<v1TransactionStatus, string> = {
  [v1TransactionStatus.TRANSACTION_STATUS_UNSPECIFIED]: '—',
  [v1TransactionStatus.TRANSACTION_STATUS_REALIZED]: 'Realizovana',
  [v1TransactionStatus.TRANSACTION_STATUS_REJECTED]: 'Odbijena',
  [v1TransactionStatus.TRANSACTION_STATUS_PROCESSING]: 'U obradi',
}
