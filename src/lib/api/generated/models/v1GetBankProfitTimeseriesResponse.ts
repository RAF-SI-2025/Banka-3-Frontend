/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { v1BankProfitBucket } from './v1BankProfitBucket';
export type v1GetBankProfitTimeseriesResponse = {
    buckets?: Array<v1BankProfitBucket>;
    /**
     * Σ profit_rsd across every returned bucket (the last bucket's
     * cumulative_rsd, or "0" when the window is empty).
     */
    totalRsd?: string;
};

