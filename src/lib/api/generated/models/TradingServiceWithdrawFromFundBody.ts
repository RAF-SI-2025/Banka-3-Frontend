/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type TradingServiceWithdrawFromFundBody = {
    amountRsd?: string;
    /**
     * Destination account. Same rules as InvestInFundRequest.
     */
    destAccountId?: string;
    onBehalfClientId?: string;
    /**
     * Optional convenience: when true, server ignores `amount_rsd` and
     * withdraws the full current value of the caller's position.
     */
    withdrawAll?: boolean;
};

