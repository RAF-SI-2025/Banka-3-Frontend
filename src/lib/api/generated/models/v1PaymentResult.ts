/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { v1Transaction } from './v1Transaction';
import type { v1TransactionStatus } from './v1TransactionStatus';
export type v1PaymentResult = {
    /**
     * op_id groups the transactions; ListTransactions can filter on it
     * to render a single grouped row in pregled plaćanja.
     */
    opId?: string;
    transactions?: Array<v1Transaction>;
    status?: v1TransactionStatus;
};

