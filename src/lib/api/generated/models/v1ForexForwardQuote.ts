/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaBankV1Currency } from './bankaBankV1Currency';
export type v1ForexForwardQuote = {
    baseCurrency?: bankaBankV1Currency;
    quoteCurrency?: bankaBankV1Currency;
    notional?: string;
    spotAskRate?: string;
    spreadFactor?: string;
    daysToSettlement?: number;
    forwardRate?: string;
    quoteAmount?: string;
    commission?: string;
};
