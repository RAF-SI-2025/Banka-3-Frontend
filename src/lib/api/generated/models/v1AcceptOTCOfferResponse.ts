/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { v1OTCContract } from './v1OTCContract';
export type v1AcceptOTCOfferResponse = {
    contract?: v1OTCContract;
    /**
     * Bank op_id of the premium leg, for ops correlation.
     */
    premiumOpId?: string;
};

