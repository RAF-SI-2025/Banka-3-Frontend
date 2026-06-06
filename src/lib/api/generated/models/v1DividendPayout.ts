/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaTradingV1Currency } from './bankaTradingV1Currency';
import type { bankaTradingV1UserKind } from './bankaTradingV1UserKind';
/**
 * DividendPayout is one quarterly dividend credited to a holder
 * (todoSpec C3 S54-S59). gross_amount/currency are in the security's
 * listing currency; account_id is the account actually credited;
 * tax_rsd is the 15% capital-gains tax owed (0 for actuary "in the name
 * of the bank" payouts, S58).
 */
export type v1DividendPayout = {
    id?: string;
    userId?: string;
    userKind?: bankaTradingV1UserKind;
    securityId?: string;
    quantity?: number;
    price?: string;
    grossAmount?: string;
    currency?: bankaTradingV1Currency;
    accountId?: string;
    taxRsd?: string;
    status?: string;
    paidAt?: string;
    createdAt?: string;
};

