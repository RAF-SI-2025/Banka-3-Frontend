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
    /**
     * Spec p.74 fund-detail holdings columns: daily change, traded
     * volume, and the security's initial margin cost (1.1 ×
     * maintenance margin), in the holding's currency.
     */
    changeAmt?: string;
    volume?: string;
    initialMarginCost?: string;
};

