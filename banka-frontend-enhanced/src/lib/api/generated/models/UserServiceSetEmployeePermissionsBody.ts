/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UserServiceSetEmployeePermissionsBody = {
    /**
     * Permissions list is bounded; max 64 covers admin's full set with
     * headroom for c3+ growth.
     */
    permissions?: Array<string>;
};

