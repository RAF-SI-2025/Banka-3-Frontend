/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type BankServiceUpdateAccountNameBody = {
    /**
     * Spec p.20 doesn't pin a length; we cap at 64 to keep the column
     * bounded and the UI tidy. Min 1 because empty would defeat the
     * "must differ from current" rule.
     */
    name?: string;
};

