/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaTradingV1Currency } from './bankaTradingV1Currency';
/**
 * RealizedPnLRow is one closing-sell row, decorated with the security
 * ticker for display. tax_amount_rsd is 15% of max(profit_rsd, 0) per
 * spec p.62 (losses don't generate tax under the simple model).
 */
export type v1RealizedPnLRow = {
    id?: string;
    saleAt?: string;
    securityId?: string;
    ticker?: string;
    quantity?: number;
    costBasisAmt?: string;
    proceedsAmt?: string;
    currency?: bankaTradingV1Currency;
    profitNative?: string;
    profitRsd?: string;
    taxAmountRsd?: string;
    taxed?: boolean;
    taxedAt?: string;
    taxOpId?: string;
    accountId?: string;
};

