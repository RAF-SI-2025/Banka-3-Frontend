/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type TradingServiceWithdrawFromFundBody = {
    /**
     * Empty when `withdraw_all` is set — the server then ignores this and
     * redeems the full position. IGNORE_IF_ZERO_VALUE so an unset amount
     * skips the pattern; a present-but-malformed amount is still caught,
     * and an empty amount without withdraw_all is rejected by the handler.
     */
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

