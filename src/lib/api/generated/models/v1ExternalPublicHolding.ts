/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaTradingV1Currency } from './bankaTradingV1Currency';
import type { v1SecurityType } from './v1SecurityType';
/**
 * ExternalPublicHolding is one row in the discovery aggregation —
 * flattened across partner banks.
 */
export type v1ExternalPublicHolding = {
    bankCode?: string;
    sellerUserRef?: string;
    sellerDisplay?: string;
    sellerHoldingId?: string;
    securityTicker?: string;
    securityType?: v1SecurityType;
    currency?: bankaTradingV1Currency;
    quantity?: number;
    askPrice?: string;
    premium?: string;
};

