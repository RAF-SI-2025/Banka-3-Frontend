/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaBankV1Currency } from './bankaBankV1Currency';
import type { v1InstallmentStatus } from './v1InstallmentStatus';
export type v1LoanInstallment = {
    id?: string;
    loanId?: string;
    sequenceNumber?: number;
    amount?: string;
    interestRateAtDue?: string;
    currency?: bankaBankV1Currency;
    expectedDueDate?: string;
    actualPaidAt?: string;
    status?: v1InstallmentStatus;
};

