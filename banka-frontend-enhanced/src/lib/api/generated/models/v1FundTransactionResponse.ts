/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { v1FundTransaction } from './v1FundTransaction';
export type v1FundTransactionResponse = {
    transaction?: v1FundTransaction;
    /**
     * saga_id of the invest/withdraw saga so the FE can poll progress on
     * illiquid withdraws (PR8 tests rely on this).
     */
    sagaId?: string;
    /**
     * When true, the withdraw landed on the illiquid path (auto-liquidation
     * in progress); the transaction stays in pending until orders settle.
     */
    pending?: boolean;
};

