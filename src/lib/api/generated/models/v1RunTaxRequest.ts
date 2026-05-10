/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaTradingV1UserKind } from './bankaTradingV1UserKind';
export type v1RunTaxRequest = {
    /**
     * user_id empty = run for everyone with a non-zero unpaid tax.
     */
    userId?: string;
    userKind?: bankaTradingV1UserKind;
};

