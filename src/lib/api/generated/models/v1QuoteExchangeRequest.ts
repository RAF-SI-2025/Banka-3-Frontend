/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaBankV1Currency } from './bankaBankV1Currency';
export type v1QuoteExchangeRequest = {
    from?: bankaBankV1Currency;
    to?: bankaBankV1Currency;
    amount?: string;
    /**
     * include_commission: when true the response factors the bank's
     * menjačnica commission. Set to false for the rates calculator
     * page where we just want the raw equivalent.
     */
    includeCommission?: boolean;
};

