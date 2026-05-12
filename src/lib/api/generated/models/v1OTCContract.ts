/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaTradingV1Currency } from './bankaTradingV1Currency';
import type { bankaTradingV1UserKind } from './bankaTradingV1UserKind';
import type { v1OTCContractStatus } from './v1OTCContractStatus';
export type v1OTCContract = {
    id?: string;
    threadId?: string;
    securityId?: string;
    securityTicker?: string;
    sellerHoldingId?: string;
    buyerId?: string;
    buyerKind?: bankaTradingV1UserKind;
    buyerAccountId?: string;
    sellerId?: string;
    sellerKind?: bankaTradingV1UserKind;
    sellerAccountId?: string;
    quantity?: number;
    strikePrice?: string;
    premiumPaid?: string;
    currency?: bankaTradingV1Currency;
    settlementDate?: string;
    premiumOpId?: string;
    status?: v1OTCContractStatus;
    exercisedOpId?: string;
    exerciseSagaId?: string;
    exercisedAt?: string;
    createdAt?: string;
    updatedAt?: string;
};

