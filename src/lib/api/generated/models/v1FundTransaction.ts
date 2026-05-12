/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { v1FundTransactionStatus } from './v1FundTransactionStatus';
export type v1FundTransaction = {
    id?: string;
    fundId?: string;
    clientId?: string;
    initiatorEmployeeId?: string;
    amountRsd?: string;
    unitsDelta?: string;
    sourceOrDestAccountId?: string;
    isInflow?: boolean;
    status?: v1FundTransactionStatus;
    sagaId?: string;
    failureReason?: string;
    createdAt?: string;
    updatedAt?: string;
};

