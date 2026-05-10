/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaBankV1Currency } from './bankaBankV1Currency';
import type { v1InterestType } from './v1InterestType';
import type { v1LoanStatus } from './v1LoanStatus';
import type { v1LoanType } from './v1LoanType';
export type v1Loan = {
    id?: string;
    loanNumber?: string;
    requestId?: string;
    clientId?: string;
    accountId?: string;
    loanType?: v1LoanType;
    interestType?: v1InterestType;
    principal?: string;
    currency?: bankaBankV1Currency;
    baseRate?: string;
    margin?: string;
    currentOffset?: string;
    /**
     * effective_rate is base + offset + margin (annual %).
     */
    effectiveRate?: string;
    installmentsTotal?: number;
    installmentAmount?: string;
    remainingPrincipal?: string;
    nextInstallmentDate?: string;
    nextInstallmentAmount?: string;
    status?: v1LoanStatus;
    contractedAt?: string;
    maturesAt?: string;
};

