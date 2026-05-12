/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaTradingV1Currency } from './bankaTradingV1Currency';
import type { v1Security } from './v1Security';
export type v1FundHolding = {
    holdingId?: string;
    security?: v1Security;
    quantity?: number;
    weightedAvgPrice?: string;
    currentPrice?: string;
    marketValue?: string;
    profitNative?: string;
    currency?: bankaTradingV1Currency;
    acquiredAt?: string;
    updatedAt?: string;
};

