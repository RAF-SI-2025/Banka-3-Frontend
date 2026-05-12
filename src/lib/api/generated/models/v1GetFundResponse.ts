/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { v1Fund } from './v1Fund';
import type { v1FundHolding } from './v1FundHolding';
import type { v1FundPosition } from './v1FundPosition';
export type v1GetFundResponse = {
    fund?: v1Fund;
    holdings?: Array<v1FundHolding>;
    /**
     * The caller's position in this fund, when one exists. For supervisors
     * viewing the bank-as-client slice, pass `client_id` query param.
     */
    position?: v1FundPosition;
};

