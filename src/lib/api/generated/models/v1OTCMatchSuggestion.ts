/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaTradingV1Currency } from './bankaTradingV1Currency';
import type { bankaTradingV1UserKind } from './bankaTradingV1UserKind';
import type { v1Security } from './v1Security';
/**
 * OTCMatchSuggestion is one candidate seller holding the buyer could
 * open an offer against. It carries the seller-side details the FE needs
 * to prefill CreateOTCOffer.
 */
export type v1OTCMatchSuggestion = {
    holdingId?: string;
    sellerId?: string;
    sellerKind?: bankaTradingV1UserKind;
    sellerAccountId?: string;
    sellerDisplayName?: string;
    security?: v1Security;
    /**
     * unit_price is the seller's current ask (the listing price) — the
     * value compared against the tolerance band.
     */
    unitPrice?: string;
    currency?: bankaTradingV1Currency;
    /**
     * available_count is the seller's inventory available on the OTC board
     * (public_count - reserved_count, clamped to zero).
     */
    availableCount?: number;
    /**
     * suggested_quantity is min(available_count, requested quantity).
     */
    suggestedQuantity?: number;
    /**
     * fully_satisfies is true when available_count >= requested quantity;
     * false signals the FE to render a partial-fill hint.
     */
    fullySatisfies?: boolean;
    /**
     * price_delta_pct is the signed % difference of unit_price vs. the
     * buyer's requested price ((unit-price)/price*100); negative is cheaper.
     */
    priceDeltaPct?: number;
};

