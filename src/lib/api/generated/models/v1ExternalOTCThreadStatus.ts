/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * ExternalOTCThreadStatus mirrors the local OTCStatus enum but kept
 * separate so the two domains can evolve independently.
 *
 * - EXTERNAL_OTC_THREAD_STATUS_REJECTED: REJECTED — partner returned a terminal error during a write;
 * we mark the thread terminal so the user sees a final state.
 */
export enum v1ExternalOTCThreadStatus {
    EXTERNAL_OTC_THREAD_STATUS_UNSPECIFIED = 'EXTERNAL_OTC_THREAD_STATUS_UNSPECIFIED',
    EXTERNAL_OTC_THREAD_STATUS_OPEN = 'EXTERNAL_OTC_THREAD_STATUS_OPEN',
    EXTERNAL_OTC_THREAD_STATUS_SUPERSEDED = 'EXTERNAL_OTC_THREAD_STATUS_SUPERSEDED',
    EXTERNAL_OTC_THREAD_STATUS_ACCEPTED = 'EXTERNAL_OTC_THREAD_STATUS_ACCEPTED',
    EXTERNAL_OTC_THREAD_STATUS_WITHDRAWN = 'EXTERNAL_OTC_THREAD_STATUS_WITHDRAWN',
    EXTERNAL_OTC_THREAD_STATUS_EXPIRED = 'EXTERNAL_OTC_THREAD_STATUS_EXPIRED',
    EXTERNAL_OTC_THREAD_STATUS_REJECTED = 'EXTERNAL_OTC_THREAD_STATUS_REJECTED',
}
