/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ExternalOTCServiceAcceptExternalOTCOfferBody } from '../models/ExternalOTCServiceAcceptExternalOTCOfferBody';
import type { ExternalOTCServiceCounterExternalOTCOfferBody } from '../models/ExternalOTCServiceCounterExternalOTCOfferBody';
import type { ExternalOTCServiceExerciseExternalOTCContractBody } from '../models/ExternalOTCServiceExerciseExternalOTCContractBody';
import type { ExternalOTCServiceWithdrawExternalOTCOfferBody } from '../models/ExternalOTCServiceWithdrawExternalOTCOfferBody';
import type { rpcStatus } from '../models/rpcStatus';
import type { v1AcceptExternalOTCOfferResponse } from '../models/v1AcceptExternalOTCOfferResponse';
import type { v1CreateExternalOTCOfferRequest } from '../models/v1CreateExternalOTCOfferRequest';
import type { v1CreateExternalOTCOfferResponse } from '../models/v1CreateExternalOTCOfferResponse';
import type { v1ExerciseExternalOTCContractResponse } from '../models/v1ExerciseExternalOTCContractResponse';
import type { v1ExternalOTCThread } from '../models/v1ExternalOTCThread';
import type { v1GetExternalOTCThreadResponse } from '../models/v1GetExternalOTCThreadResponse';
import type { v1ListExternalOTCContractsResponse } from '../models/v1ListExternalOTCContractsResponse';
import type { v1ListExternalOTCThreadsResponse } from '../models/v1ListExternalOTCThreadsResponse';
import type { v1ListExternalPublicHoldingsResponse } from '../models/v1ListExternalPublicHoldingsResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ExternalOtcServiceService {
    /**
     * @returns v1ListExternalOTCContractsResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static externalOtcServiceListExternalOtcContracts({
        status = 'EXTERNAL_OTC_CONTRACT_STATUS_UNSPECIFIED',
    }: {
        status?: 'EXTERNAL_OTC_CONTRACT_STATUS_UNSPECIFIED' | 'EXTERNAL_OTC_CONTRACT_STATUS_ACTIVE' | 'EXTERNAL_OTC_CONTRACT_STATUS_EXERCISED' | 'EXTERNAL_OTC_CONTRACT_STATUS_EXPIRED' | 'EXTERNAL_OTC_CONTRACT_STATUS_SETTLING',
    }): CancelablePromise<v1ListExternalOTCContractsResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/otc/external-contracts',
            query: {
                'status': status,
            },
        });
    }
    /**
     * ExerciseExternalOTCContract runs the external_otc_exercise SAGA
     * (reserve strike notional → instruct partner to settle → confirm).
     * Gated by spec p.11 verification on the gateway.
     * @returns v1ExerciseExternalOTCContractResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static externalOtcServiceExerciseExternalOtcContract({
        bankCode,
        contractId,
        body,
    }: {
        bankCode: string,
        contractId: string,
        body: ExternalOTCServiceExerciseExternalOTCContractBody,
    }): CancelablePromise<v1ExerciseExternalOTCContractResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/otc/external-contracts/{bankCode}/{contractId}/exercise',
            path: {
                'bankCode': bankCode,
                'contractId': contractId,
            },
            body: body,
        });
    }
    /**
     * ListExternalPublicHoldings aggregates partner banks' /otc/public
     * (or Banka2 /public-stock) responses. Gateway fans out across the
     * configured partner routes and merges. Filters by bank_code and/or
     * ticker.
     * @returns v1ListExternalPublicHoldingsResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static externalOtcServiceListExternalPublicHoldings({
        bankCode,
        ticker,
    }: {
        /**
         * Optional filter on partner bank code (e.g. "444"). Empty = all
         * configured partners.
         */
        bankCode?: string,
        /**
         * Optional ticker prefix filter.
         */
        ticker?: string,
    }): CancelablePromise<v1ListExternalPublicHoldingsResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/otc/external-discovery',
            query: {
                'bankCode': bankCode,
                'ticker': ticker,
            },
        });
    }
    /**
     * ListExternalOTCThreads — drives the "Aktivne ponude (eksterno)"
     * page. Caller sees threads where they are the local party. Status
     * filter is optional.
     * @returns v1ListExternalOTCThreadsResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static externalOtcServiceListExternalOtcThreads({
        status = 'EXTERNAL_OTC_THREAD_STATUS_UNSPECIFIED',
    }: {
        /**
         * Optional status filter; UNSPECIFIED = all.
         *
         * - EXTERNAL_OTC_THREAD_STATUS_REJECTED: REJECTED — partner returned a terminal error during a write;
         * we mark the thread terminal so the user sees a final state.
         */
        status?: 'EXTERNAL_OTC_THREAD_STATUS_UNSPECIFIED' | 'EXTERNAL_OTC_THREAD_STATUS_OPEN' | 'EXTERNAL_OTC_THREAD_STATUS_SUPERSEDED' | 'EXTERNAL_OTC_THREAD_STATUS_ACCEPTED' | 'EXTERNAL_OTC_THREAD_STATUS_WITHDRAWN' | 'EXTERNAL_OTC_THREAD_STATUS_EXPIRED' | 'EXTERNAL_OTC_THREAD_STATUS_REJECTED',
    }): CancelablePromise<v1ListExternalOTCThreadsResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/otc/external-offers',
            query: {
                'status': status,
            },
        });
    }
    /**
     * CreateExternalOTCOffer opens an outbound negotiation against a
     * partner-advertised holding. Caller is the buyer; partner is the
     * seller. The local mirror row is created in 'open' state; the
     * outbound POST to the partner happens synchronously inside the
     * call so a 4xx from the partner surfaces immediately.
     * @returns v1CreateExternalOTCOfferResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static externalOtcServiceCreateExternalOtcOffer({
        body,
    }: {
        body: v1CreateExternalOTCOfferRequest,
    }): CancelablePromise<v1CreateExternalOTCOfferResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/otc/external-offers',
            body: body,
        });
    }
    /**
     * AcceptExternalOTCOffer accepts the open iteration and mints a
     * contract via the external_otc_premium SAGA. Premium transfers
     * cross-bank through the bank-2PC primitive. Gated by spec p.11
     * verification on the gateway.
     * @returns v1AcceptExternalOTCOfferResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static externalOtcServiceAcceptExternalOtcOffer({
        bankCode,
        threadId,
        body,
    }: {
        bankCode: string,
        threadId: string,
        body: ExternalOTCServiceAcceptExternalOTCOfferBody,
    }): CancelablePromise<v1AcceptExternalOTCOfferResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/otc/external-offers/{bankCode}/{threadId}/accept',
            path: {
                'bankCode': bankCode,
                'threadId': threadId,
            },
            body: body,
        });
    }
    /**
     * CounterExternalOTCOffer appends an iteration; gateway forwards to
     * the partner. Caller must be the side allowed to counter (the side
     * that did not move last).
     * @returns v1ExternalOTCThread A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static externalOtcServiceCounterExternalOtcOffer({
        bankCode,
        threadId,
        body,
    }: {
        bankCode: string,
        threadId: string,
        body: ExternalOTCServiceCounterExternalOTCOfferBody,
    }): CancelablePromise<v1ExternalOTCThread | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/otc/external-offers/{bankCode}/{threadId}/counter',
            path: {
                'bankCode': bankCode,
                'threadId': threadId,
            },
            body: body,
        });
    }
    /**
     * WithdrawExternalOTCOffer pulls the thread. Either party can
     * withdraw a thread in 'open' state.
     * @returns v1ExternalOTCThread A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static externalOtcServiceWithdrawExternalOtcOffer({
        bankCode,
        threadId,
        body,
    }: {
        bankCode: string,
        threadId: string,
        body: ExternalOTCServiceWithdrawExternalOTCOfferBody,
    }): CancelablePromise<v1ExternalOTCThread | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/otc/external-offers/{bankCode}/{threadId}/withdraw',
            path: {
                'bankCode': bankCode,
                'threadId': threadId,
            },
            body: body,
        });
    }
    /**
     * GetExternalOTCThread returns the thread + every iteration (oldest
     * first) + the contract if accepted.
     * @returns v1GetExternalOTCThreadResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static externalOtcServiceGetExternalOtcThread({
        threadId,
    }: {
        threadId: string,
    }): CancelablePromise<v1GetExternalOTCThreadResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/otc/external-offers/{threadId}',
            path: {
                'threadId': threadId,
            },
        });
    }
}
