/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type v1CreateFundRequest = {
    name?: string;
    description?: string;
    minimumContribution?: string;
    /**
     * Optional manager override (defaults to caller). Admin only.
     */
    managerUserId?: string;
};

