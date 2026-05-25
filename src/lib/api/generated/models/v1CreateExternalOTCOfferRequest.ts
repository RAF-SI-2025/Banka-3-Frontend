/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaTradingV1Currency } from './bankaTradingV1Currency';
import type { v1SecurityType } from './v1SecurityType';
export type v1CreateExternalOTCOfferRequest = {
    remoteBankCode?: string;
    remoteUserRef?: string;
    remoteDisplayName?: string;
    buyerAccountId?: string;
    sellerHoldingId?: string;
    securityTicker?: string;
    securityType?: v1SecurityType;
    currency?: bankaTradingV1Currency;
    quantity?: number;
    pricePerUnit?: string;
    premium?: string;
    settlementDate?: string;
};

