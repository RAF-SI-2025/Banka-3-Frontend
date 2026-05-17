/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaBankV1Currency } from './bankaBankV1Currency';
import type { v1AccountKind } from './v1AccountKind';
import type { v1AccountSubtype } from './v1AccountSubtype';
export type v1CreateAccountRequest = {
    ownerClientId?: string;
    /**
     * Required for ACCOUNT_KIND_BUSINESS_*; UUID format when set.
     */
    companyId?: string;
    kind?: v1AccountKind;
    subtype?: v1AccountSubtype;
    currency?: bankaBankV1Currency;
    name?: string;
    /**
     * Decimal string with up to 4 fraction digits; "0" if absent. Match
     * the storage scale so we don't quietly truncate.
     */
    openingBalance?: string;
    createCard?: boolean;
};

