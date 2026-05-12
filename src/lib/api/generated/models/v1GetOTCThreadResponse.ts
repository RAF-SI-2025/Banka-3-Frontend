/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { v1OTCContract } from './v1OTCContract';
import type { v1OTCOffer } from './v1OTCOffer';
export type v1GetOTCThreadResponse = {
    /**
     * Every iteration in the thread, oldest first.
     */
    iterations?: Array<v1OTCOffer>;
    /**
     * The signed contract if accept already ran.
     */
    contract?: v1OTCContract;
};

