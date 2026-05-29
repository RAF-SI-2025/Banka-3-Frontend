/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { v1CardBrand } from './v1CardBrand';
export type v1CreateCardRequest = {
    accountId?: string;
    /**
     * Required for poslovni-with-OvlascenoLice; UUID format when set.
     */
    authorizedPersonId?: string;
    brand?: v1CardBrand;
    /**
     * Name is optional — service layer falls back to a sensible default
     * ("Debit") when blank. Cap is generous; only the upper bound matters.
     */
    name?: string;
    /**
     * card_limit must be a positive decimal. Pattern enforces shape; the
     * service layer additionally rejects "0" so callers can't bypass via
     * "0.00".
     */
    cardLimit?: string;
};

