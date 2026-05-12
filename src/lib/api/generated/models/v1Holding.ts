/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaTradingV1UserKind } from './bankaTradingV1UserKind';
import type { v1Security } from './v1Security';
export type v1Holding = {
    id?: string;
    userId?: string;
    userKind?: bankaTradingV1UserKind;
    security?: v1Security;
    accountId?: string;
    quantity?: number;
    weightedAvgPrice?: string;
    publicCount?: number;
    /**
     * Computed market metrics.
     */
    currentPrice?: string;
    marketValue?: string;
    profit?: string;
    acquiredAt?: string;
    updatedAt?: string;
    /**
     * c4 (spec p.68) — count of shares committed against outstanding OTC
     * offers + active OTC contracts. public_count and reserved_count are
     * orthogonal; the FE renders public_count − reserved_count as the
     * "available on the OTC board" number.
     */
    reservedCount?: number;
};

