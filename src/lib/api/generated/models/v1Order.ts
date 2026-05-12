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
    /**
     * c4 PR3 — actor_kind discriminates whether this order was placed on
     * behalf of the user themselves or for an investment fund they
     * manage. on_behalf_of_fund_id is non-empty when actor_kind == FUND.
     * For backward compat, default actor_kind is whatever user_kind
     * resolved to at create time (client or employee).
     */
    actorKind?: bankaTradingV1UserKind;
    onBehalfOfFundId?: string;
};

