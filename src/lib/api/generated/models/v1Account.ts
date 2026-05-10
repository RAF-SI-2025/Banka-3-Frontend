/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaBankV1Currency } from './bankaBankV1Currency';
import type { v1AccountKind } from './v1AccountKind';
import type { v1AccountStatus } from './v1AccountStatus';
import type { v1AccountSubtype } from './v1AccountSubtype';
/**
 * Account mirrors spec p.12-13 fields. Money is encoded as a decimal
 * string (e.g. "180.00") so we don't lose precision over JSON; the
 * bank service stores it as numeric(20,4).
 */
export type v1Account = {
    id?: string;
    number?: string;
    name?: string;
    ownerClientId?: string;
    companyId?: string;
    createdByEmployeeId?: string;
    kind?: v1AccountKind;
    subtype?: v1AccountSubtype;
    currency?: bankaBankV1Currency;
    status?: v1AccountStatus;
    balance?: string;
    availableBalance?: string;
    maintenanceFee?: string;
    dailyLimit?: string;
    monthlyLimit?: string;
    dailySpent?: string;
    monthlySpent?: string;
    createdAt?: string;
    expiresAt?: string;
    updatedAt?: string;
};

