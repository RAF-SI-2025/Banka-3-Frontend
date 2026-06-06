/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaBankV1Currency } from './bankaBankV1Currency';
import type { v1ForexForwardStatus } from './v1ForexForwardStatus';
export type v1ForexForward = {
    id?: string;
    clientId?: string;
    baseCurrency?: bankaBankV1Currency;
    quoteCurrency?: bankaBankV1Currency;
    notional?: string;
    forwardRate?: string;
    spotAskRate?: string;
    spreadFactor?: string;
    daysToSettlement?: number;
    commission?: string;
    reservationId?: string;
    fromAccountId?: string;
    toAccountId?: string;
    settlementDate?: string;
    status?: v1ForexForwardStatus;
    failureReason?: string;
    createdAt?: string;
    settledAt?: string;
};
