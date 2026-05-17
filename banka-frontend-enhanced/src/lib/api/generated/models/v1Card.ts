/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { v1CardBrand } from './v1CardBrand';
import type { v1CardStatus } from './v1CardStatus';
export type v1Card = {
    id?: string;
    /**
     * Number is returned masked ("4111********1111") when the caller is
     * a client; employees with card.write see the full number.
     */
    number?: string;
    brand?: v1CardBrand;
    name?: string;
    accountId?: string;
    authorizedPersonId?: string;
    cardLimit?: string;
    status?: v1CardStatus;
    expiresAt?: string;
    createdAt?: string;
    updatedAt?: string;
};

