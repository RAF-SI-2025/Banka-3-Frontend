/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { rpcStatus } from '../models/rpcStatus';
import type { v1ListRatesResponse } from '../models/v1ListRatesResponse';
import type { v1Rate } from '../models/v1Rate';
import type { v1UpsertRateRequest } from '../models/v1UpsertRateRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ExchangeServiceService {
    /**
     * @returns v1ListRatesResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static exchangeServiceListRates({
        from = 'CURRENCY_UNSPECIFIED',
    }: {
        /**
         * When set, only the rows for that base currency are returned (e.g.
         * RSD → * for the menjačnica board).
         */
        from?: 'CURRENCY_UNSPECIFIED' | 'CURRENCY_RSD' | 'CURRENCY_EUR' | 'CURRENCY_CHF' | 'CURRENCY_USD' | 'CURRENCY_GBP' | 'CURRENCY_JPY' | 'CURRENCY_CAD' | 'CURRENCY_AUD',
    }): CancelablePromise<v1ListRatesResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/exchange/rates',
            query: {
                'from': from,
            },
        });
    }
    /**
     * @returns v1Rate A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static exchangeServiceUpsertRate({
        body,
    }: {
        body: v1UpsertRateRequest,
    }): CancelablePromise<v1Rate | rpcStatus> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/exchange/rates',
            body: body,
        });
    }
}
