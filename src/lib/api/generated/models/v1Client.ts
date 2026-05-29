/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaUserV1Gender } from './bankaUserV1Gender';
export type v1Client = {
    id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: bankaUserV1Gender;
    phone?: string;
    address?: string;
    active?: boolean;
    permissions?: Array<string>;
    createdAt?: string;
    updatedAt?: string;
};

