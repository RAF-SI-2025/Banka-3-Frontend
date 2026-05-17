/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaTradingV1Currency } from './bankaTradingV1Currency';
import type { v1Holding } from './v1Holding';
export type v1ExerciseOptionResponse = {
    /**
     * Updated option holding after the exercise. Quantity may be 0;
     * the row is left in place for audit (FE filters quantity > 0).
     */
    optionHolding?: v1Holding;
    /**
     * Updated underlying holding after the exercise — increased on a
     * CALL, decreased on a PUT.
     */
    underlyingHolding?: v1Holding;
    /**
     * Bank-side op_id of the cash leg, for ops correlation.
     */
    bankOpId?: string;
    /**
     * PUT only — realized gain on the underlying shares sold at strike.
     * Both fields are zero for a CALL exercise (cost-basis update via
     * weighted-avg, no realisation event).
     */
    realizedGainNative?: string;
    realizedGainRsd?: string;
    realizedGainCurrency?: bankaTradingV1Currency;
};

