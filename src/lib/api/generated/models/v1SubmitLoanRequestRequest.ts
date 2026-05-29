/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaBankV1Currency } from './bankaBankV1Currency';
import type { v1EmploymentStatus } from './v1EmploymentStatus';
import type { v1InterestType } from './v1InterestType';
import type { v1LoanType } from './v1LoanType';
export type v1SubmitLoanRequestRequest = {
    accountId?: string;
    loanType?: v1LoanType;
    interestType?: v1InterestType;
    amount?: string;
    currency?: bankaBankV1Currency;
    purpose?: string;
    monthlySalary?: string;
    employmentStatus?: v1EmploymentStatus;
    employmentDurationMonths?: number;
    /**
     * Spec p.31: discrete tenor counts; the service-layer further checks
     * the value against the loan type (housing 60–360, others 12–84).
     */
    installmentsTotal?: number;
    contactPhone?: string;
};

