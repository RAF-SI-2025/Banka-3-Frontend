/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaTradingV1UserKind } from './bankaTradingV1UserKind';
import type { v1Direction } from './v1Direction';
import type { v1OrderStatus } from './v1OrderStatus';
import type { v1OrderType } from './v1OrderType';
export type v1Order = {
    id?: string;
    userId?: string;
    userKind?: bankaTradingV1UserKind;
    securityId?: string;
    orderType?: v1OrderType;
    direction?: v1Direction;
    quantity?: number;
    contractSize?: string;
    pricePerUnit?: string;
    limitPrice?: string;
    stopPrice?: string;
    allOrNone?: boolean;
    margin?: boolean;
    accountId?: string;
    status?: v1OrderStatus;
    approvedBy?: string;
    approvalRequired?: boolean;
    approvedAt?: string;
    isDone?: boolean;
    cancelled?: boolean;
    triggered?: boolean;
    afterHours?: boolean;
    remainingQuantity?: number;
    lastModification?: string;
    createdAt?: string;
};

