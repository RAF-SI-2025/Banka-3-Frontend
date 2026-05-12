/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaTradingV1Currency } from './bankaTradingV1Currency';
import type { bankaTradingV1UserKind } from './bankaTradingV1UserKind';
import type { v1Security } from './v1Security';
/**
 * PublicHoldingItem is one row on the OTC discovery board. The
 * "available_count" field is the share count visible to negotiations —
 * public_count minus reserved_count, clamped to zero.
 */
export type v1PublicHoldingItem = {
    holdingId?: string;
    sellerId?: string;
    sellerKind?: bankaTradingV1UserKind;
    sellerAccountId?: string;
    sellerDisplayName?: string;
    security?: v1Security;
    availableCount?: number;
    publicCount?: number;
    reservedCount?: number;
    currentPrice?: string;
    currency?: bankaTradingV1Currency;
};

