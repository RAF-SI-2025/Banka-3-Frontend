/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaExchangeV1Currency } from './bankaExchangeV1Currency';
/**
 * Rate is one row of the FX table. base/quote are decimal strings to
 * preserve precision. The pair is directional: from RSD to EUR is a
 * different row than from EUR to RSD. The menjačnica formula uses
 * (1 ± margin) on the mid; we store the resolved bid/ask so the bank
 * service doesn't need to know the spread policy.
 */
export type v1Rate = {
    from?: bankaExchangeV1Currency;
    to?: bankaExchangeV1Currency;
    bid?: string;
    ask?: string;
    updatedAt?: string;
};

