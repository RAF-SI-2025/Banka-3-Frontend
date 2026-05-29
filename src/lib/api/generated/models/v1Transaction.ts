/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { v1TransactionKind } from './v1TransactionKind';
import type { v1TransactionStatus } from './v1TransactionStatus';
/**
 * Transaction is one ledger leg. UX-level operations (a payment, a
 * transfer) are reconstructed by grouping on op_id.
 */
export type v1Transaction = {
    id?: string;
    opId?: string;
    kind?: v1TransactionKind;
    legIndex?: number;
    fromAccountId?: string;
    toAccountId?: string;
    fromAmount?: string;
    toAmount?: string;
    rate?: string;
    recipientName?: string;
    paymentCode?: string;
    referenceNumber?: string;
    purpose?: string;
    initiatorClientId?: string;
    status?: v1TransactionStatus;
    createdAt?: string;
    /**
     * The 18-digit account numbers behind from/to_account_id, resolved
     * server-side. The FE renders these in the "Drugi račun" column — a
     * client can't (and mustn't be able to) resolve a counterparty
     * account UUID it doesn't own. Empty when the leg's account isn't a
     * locally-held bank account (e.g. a future c5 inter-bank peer).
     */
    fromAccountNumber?: string;
    toAccountNumber?: string;
};

