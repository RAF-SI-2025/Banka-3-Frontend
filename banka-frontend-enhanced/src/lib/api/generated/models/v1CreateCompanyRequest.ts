/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type v1CreateCompanyRequest = {
    name?: string;
    /**
     * Matični broj is exactly 8 digits per Serbian APR.
     */
    registryId?: string;
    /**
     * PIB is exactly 9 digits.
     */
    taxId?: string;
    /**
     * Šifra delatnosti is "xx.xx" or "xx.x" (spec p.14).
     */
    activityCode?: string;
    address?: string;
    ownerClientId?: string;
};

