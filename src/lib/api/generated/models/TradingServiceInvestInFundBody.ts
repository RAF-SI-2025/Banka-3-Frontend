/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type TradingServiceInvestInFundBody = {
    /**
     * Investment amount in RSD — the fund's accounting unit (spec p.71
     * ClientFundTransaction.Iznos = "iznos investicije ... u RSD", and
     * minimumContribution is RSD). The server converts RSD → the source
     * account's currency for the debit (commission added on top for
     * clients, none for the bank/actuary). Mirrors WithdrawFromFundRequest.
     */
    amountRsd?: string;
    /**
     * Source account. Client's own RSD/FX account, or — when supervisor
     * is investing on behalf of the bank — a bank-side RSD/FX account.
     */
    sourceAccountId?: string;
    /**
     * When non-empty AND caller is supervisor, the supervisor is
     * investing in the name of the bank (spec p.75 Napomena 2 — client_id
     * = BankAsClient sentinel). UUID equality with the sentinel is
     * enforced server-side.
     */
    onBehalfClientId?: string;
};

