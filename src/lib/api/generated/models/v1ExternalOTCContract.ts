/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaTradingV1Currency } from './bankaTradingV1Currency';
import type { bankaTradingV1UserKind } from './bankaTradingV1UserKind';
import type { v1ExternalOTCContractStatus } from './v1ExternalOTCContractStatus';
import type { v1ExternalOTCDirection } from './v1ExternalOTCDirection';
import type { v1ExternalOTCRole } from './v1ExternalOTCRole';
import type { v1ExternalOTCSide } from './v1ExternalOTCSide';
export type v1ExternalOTCContract = {
    id?: string;
    threadId?: string;
    direction?: v1ExternalOTCDirection;
    remoteBankCode?: string;
    remoteThreadId?: string;
    remoteUserRef?: string;
    remoteDisplayName?: string;
    remoteAccountRef?: string;
    localUserId?: string;
    localUserKind?: bankaTradingV1UserKind;
    localAccountId?: string;
    localAccountNumber?: string;
    localRole?: v1ExternalOTCRole;
    securityId?: string;
    securityTicker?: string;
    sellerHoldingId?: string;
    quantity?: number;
    strikePrice?: string;
    premiumPaid?: string;
    currency?: bankaTradingV1Currency;
    settlementDate?: string;
    acceptedBySide?: v1ExternalOTCSide;
    status?: v1ExternalOTCContractStatus;
    premiumOpId?: string;
    exerciseOpId?: string;
    exercisedAt?: string;
    createdAt?: string;
    updatedAt?: string;
};

