/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 *  - USER_KIND_FUND: USER_KIND_FUND identifies investment-fund-as-actor rows (c4 PR3,
 * spec p.74-75). A fund-actor order's user_id is the fund's id; its
 * settlement account is the fund's bank account. Fund-actor sells do
 * not write realized_gains rows — funds are pre-tax vehicles; tax
 * attaches to the client at withdrawal time (EDGE-3).
 */
export enum bankaTradingV1UserKind {
    USER_KIND_UNSPECIFIED = 'USER_KIND_UNSPECIFIED',
    USER_KIND_CLIENT = 'USER_KIND_CLIENT',
    USER_KIND_EMPLOYEE = 'USER_KIND_EMPLOYEE',
    USER_KIND_FUND = 'USER_KIND_FUND',
}
