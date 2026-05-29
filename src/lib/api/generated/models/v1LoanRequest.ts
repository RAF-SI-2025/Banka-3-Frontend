/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaBankV1Currency } from './bankaBankV1Currency';
import type { v1EmploymentStatus } from './v1EmploymentStatus';
import type { v1InterestType } from './v1InterestType';
import type { v1LoanRequestStatus } from './v1LoanRequestStatus';
import type { v1LoanType } from './v1LoanType';
export type v1LoanRequest = {
    id?: string;
    clientId?: string;
    accountId?: string;
    loanType?: v1LoanType;
    interestType?: v1InterestType;
    amount?: string;
    currency?: bankaBankV1Currency;
    purpose?: string;
    monthlySalary?: string;
    employmentStatus?: v1EmploymentStatus;
    employmentDurationMonths?: number;
    installmentsTotal?: number;
    contactPhone?: string;
    status?: v1LoanRequestStatus;
    rejectionReason?: string;
    decidedAt?: string;
    decidedByEmployeeId?: string;
    createdAt?: string;
};

