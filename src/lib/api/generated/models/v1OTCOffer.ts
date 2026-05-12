/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaTradingV1Currency } from './bankaTradingV1Currency';
import type { bankaTradingV1UserKind } from './bankaTradingV1UserKind';
import type { v1OTCStatus } from './v1OTCStatus';
export type v1OTCOffer = {
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
    pricePerUnit?: string;
    premium?: string;
    currency?: bankaTradingV1Currency;
    settlementDate?: string;
    modifiedBy?: string;
    status?: v1OTCStatus;
    createdAt?: string;
    updatedAt?: string;
};

