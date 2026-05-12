/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { v1OTCContract } from './v1OTCContract';
export type v1ExerciseOTCContractResponse = {
    contract?: v1OTCContract;
    /**
     * Bank op_id of the strike-leg cash transfer.
     */
    strikeOpId?: string;
    /**
     * Realized-gain row written for the seller (RSD, native).
     */
    sellerRealizedGainNative?: string;
    sellerRealizedGainRsd?: string;
};

