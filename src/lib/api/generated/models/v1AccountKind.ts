/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * AccountKind picks the broad bucket; the trailing TT in the 18-digit
 * account number depends on (kind, subtype) per spec p.16. See
 * pkg/account.Type for the exact mapping.
 *
 * - ACCOUNT_KIND_PERSONAL_CHECKING_RSD: lični tekući RSD  (TT=11/13/14/15/16/17 by subtype)
 * - ACCOUNT_KIND_PERSONAL_FX: lični devizni     (TT=21)
 * - ACCOUNT_KIND_BUSINESS_CHECKING_RSD: poslovni tekući   (TT=12)
 * - ACCOUNT_KIND_BUSINESS_FX: poslovni devizni  (TT=22)
 * - ACCOUNT_KIND_SYSTEM: bank-owned house  (TT=99, internal)
 * - ACCOUNT_KIND_FOREX_BOOK: bank's per-currency FX inventory book (internal, addressable for actuary trading)
 * - ACCOUNT_KIND_STATE_TAX: RSD destination for capital-gains tax remittance (internal)
 * - ACCOUNT_KIND_FUND: investment fund's liquidity account (c4 PR3, spec p.74; FundsOwnerID sentinel as owner)
 */
export enum v1AccountKind {
    ACCOUNT_KIND_UNSPECIFIED = 'ACCOUNT_KIND_UNSPECIFIED',
    ACCOUNT_KIND_PERSONAL_CHECKING_RSD = 'ACCOUNT_KIND_PERSONAL_CHECKING_RSD',
    ACCOUNT_KIND_PERSONAL_FX = 'ACCOUNT_KIND_PERSONAL_FX',
    ACCOUNT_KIND_BUSINESS_CHECKING_RSD = 'ACCOUNT_KIND_BUSINESS_CHECKING_RSD',
    ACCOUNT_KIND_BUSINESS_FX = 'ACCOUNT_KIND_BUSINESS_FX',
    ACCOUNT_KIND_SYSTEM = 'ACCOUNT_KIND_SYSTEM',
    ACCOUNT_KIND_FOREX_BOOK = 'ACCOUNT_KIND_FOREX_BOOK',
    ACCOUNT_KIND_STATE_TAX = 'ACCOUNT_KIND_STATE_TAX',
    ACCOUNT_KIND_FUND = 'ACCOUNT_KIND_FUND',
}
