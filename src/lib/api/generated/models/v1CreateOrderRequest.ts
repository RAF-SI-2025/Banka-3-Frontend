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
};

