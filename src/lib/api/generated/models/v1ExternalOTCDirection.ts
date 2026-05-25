/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * ExternalOTCDirection encodes who initiated the thread.
 *
 * - EXTERNAL_OTC_DIRECTION_OUTGOING: OUTGOING — initiated by a user of this bank against a partner
 * holding.
 * - EXTERNAL_OTC_DIRECTION_INCOMING: INCOMING — partner-initiated against a holding we advertise.
 */
export enum v1ExternalOTCDirection {
    EXTERNAL_OTC_DIRECTION_UNSPECIFIED = 'EXTERNAL_OTC_DIRECTION_UNSPECIFIED',
    EXTERNAL_OTC_DIRECTION_OUTGOING = 'EXTERNAL_OTC_DIRECTION_OUTGOING',
    EXTERNAL_OTC_DIRECTION_INCOMING = 'EXTERNAL_OTC_DIRECTION_INCOMING',
}
