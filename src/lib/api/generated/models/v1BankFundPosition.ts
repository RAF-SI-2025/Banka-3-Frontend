/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { v1FundPosition } from './v1FundPosition';
/**
 * BankFundPosition is one row on the "bank's positions in funds"
 * dashboard (spec p.76 — "Pozicije banke u fondovima"). Wraps the
 * underlying FundPosition with the fund's display columns so the FE
 * doesn't need a second round-trip per row.
 */
export type v1BankFundPosition = {
    position?: v1FundPosition;
    fundName?: string;
    managerUserId?: string;
    managerDisplayName?: string;
};

