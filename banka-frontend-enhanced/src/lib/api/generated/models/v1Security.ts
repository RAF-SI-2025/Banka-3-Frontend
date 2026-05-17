/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaTradingV1Currency } from './bankaTradingV1Currency';
import type { v1OptionType } from './v1OptionType';
import type { v1SecurityType } from './v1SecurityType';
/**
 * Security carries the union of every type's attribute bag. Per-type
 * fields are populated only when relevant; consumers pick by `type`.
 */
export type v1Security = {
    id?: string;
    ticker?: string;
    name?: string;
    type?: v1SecurityType;
    exchangeMic?: string;
    currency?: bankaTradingV1Currency;
    /**
     * Stock fields.
     */
    outstandingShares?: string;
    dividendYield?: string;
    marketCap?: string;
    /**
     * Future fields (also reused for forex contract size).
     */
    contractSize?: string;
    contractUnit?: string;
    settlementDate?: string;
    /**
     * Forex fields.
     */
    baseCurrency?: bankaTradingV1Currency;
    quoteCurrency?: bankaTradingV1Currency;
    liquidity?: string;
    /**
     * Option fields.
     */
    underlyingSecurityId?: string;
    optionType?: v1OptionType;
    strikePrice?: string;
    impliedVolatility?: string;
    premium?: string;
    openInterest?: string;
    createdAt?: string;
    updatedAt?: string;
};

