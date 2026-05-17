/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { v1Direction } from './v1Direction';
import type { v1OrderType } from './v1OrderType';
export type v1CreateOrderRequest = {
    securityId?: string;
    orderType?: v1OrderType;
    direction?: v1Direction;
    quantity?: number;
    limitPrice?: string;
    stopPrice?: string;
    allOrNone?: boolean;
    margin?: boolean;
    accountId?: string;
    /**
     * c4 PR3 fund-actor (spec p.74-75). When set, the caller is acting on
     * behalf of an investment fund they manage; the order's owner/account
     * are the fund's. Validated against the fund row (caller is manager,
     * account is fund.bank_account_id). Empty for normal client/employee
     * orders.
     */
    onBehalfOfFundId?: string;
};

