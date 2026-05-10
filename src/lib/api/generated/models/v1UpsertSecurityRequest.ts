/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaTradingV1Currency } from './bankaTradingV1Currency';
import type { v1OptionType } from './v1OptionType';
import type { v1SecurityType } from './v1SecurityType';
export type v1UpsertSecurityRequest = {
    /**
     * For new securities, leave id empty; for updates, supply it.
     */
    id?: string;
    ticker?: string;
    name?: string;
    type?: v1SecurityType;
    exchangeMic?: string;
    currency?: bankaTradingV1Currency;
    outstandingShares?: string;
    dividendYield?: string;
    contractSize?: string;
    contractUnit?: string;
    settlementDate?: string;
    baseCurrency?: bankaTradingV1Currency;
    quoteCurrency?: bankaTradingV1Currency;
    liquidity?: string;
    underlyingSecurityId?: string;
    optionType?: v1OptionType;
    strikePrice?: string;
    impliedVolatility?: string;
    premium?: string;
    openInterest?: string;
};

