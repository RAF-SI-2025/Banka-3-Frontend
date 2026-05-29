/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaUserV1UserKind } from './bankaUserV1UserKind';
export type v1LoginResponse = {
    accessToken?: string;
    refreshToken?: string;
    accessExpiresIn?: string;
    refreshExpiresIn?: string;
    userKind?: bankaUserV1UserKind;
    userId?: string;
    permissions?: Array<string>;
    firstName?: string;
    lastName?: string;
};

