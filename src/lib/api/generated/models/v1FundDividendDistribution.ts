/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * FundDividendDistribution attributes one fund dividend across the
 * fund's investors proportional to their unit share at payout time
 * (todoSpec C4 S71).
 */
export type v1FundDividendDistribution = {
    id?: string;
    fundId?: string;
    dividendPayoutId?: string;
    clientId?: string;
    shareUnits?: string;
    fundTotalUnits?: string;
    amountRsd?: string;
    createdAt?: string;
};
