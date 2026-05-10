/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { rpcStatus } from '../models/rpcStatus';
import type { TradingServiceApproveOrderBody } from '../models/TradingServiceApproveOrderBody';
import type { TradingServiceCancelOrderBody } from '../models/TradingServiceCancelOrderBody';
import type { TradingServiceDeclineOrderBody } from '../models/TradingServiceDeclineOrderBody';
import type { TradingServiceExerciseOptionBody } from '../models/TradingServiceExerciseOptionBody';
import type { TradingServiceResetActuaryUsedLimitBody } from '../models/TradingServiceResetActuaryUsedLimitBody';
import type { TradingServiceSetActuaryNeedApprovalBody } from '../models/TradingServiceSetActuaryNeedApprovalBody';
import type { TradingServiceSetExchangeOverrideBody } from '../models/TradingServiceSetExchangeOverrideBody';
import type { TradingServiceSetPublicCountBody } from '../models/TradingServiceSetPublicCountBody';
import type { TradingServiceUpdateActuaryLimitBody } from '../models/TradingServiceUpdateActuaryLimitBody';
import type { TradingServiceUpsertActuaryInfoBody } from '../models/TradingServiceUpsertActuaryInfoBody';
import type { TradingServiceUpsertExchangeBody } from '../models/TradingServiceUpsertExchangeBody';
import type { v1ActuaryInfo } from '../models/v1ActuaryInfo';
import type { v1CreateOrderRequest } from '../models/v1CreateOrderRequest';
import type { v1CreateOrderResponse } from '../models/v1CreateOrderResponse';
import type { v1Exchange } from '../models/v1Exchange';
import type { v1ExerciseOptionResponse } from '../models/v1ExerciseOptionResponse';
import type { v1GetListingDailyHistoryResponse } from '../models/v1GetListingDailyHistoryResponse';
import type { v1GetOptionChainResponse } from '../models/v1GetOptionChainResponse';
import type { v1Holding } from '../models/v1Holding';
import type { v1ListActuariesResponse } from '../models/v1ListActuariesResponse';
import type { v1ListExchangesResponse } from '../models/v1ListExchangesResponse';
import type { v1ListHoldingsResponse } from '../models/v1ListHoldingsResponse';
import type { v1Listing } from '../models/v1Listing';
import type { v1ListListingsResponse } from '../models/v1ListListingsResponse';
import type { v1ListOrdersResponse } from '../models/v1ListOrdersResponse';
import type { v1ListRealizedPnLResponse } from '../models/v1ListRealizedPnLResponse';
import type { v1ListSecuritiesResponse } from '../models/v1ListSecuritiesResponse';
import type { v1ListTaxPositionsResponse } from '../models/v1ListTaxPositionsResponse';
import type { v1Order } from '../models/v1Order';
import type { v1RunDailyResetActuariesResponse } from '../models/v1RunDailyResetActuariesResponse';
import type { v1RunTaxRequest } from '../models/v1RunTaxRequest';
import type { v1RunTaxResponse } from '../models/v1RunTaxResponse';
import type { v1Security } from '../models/v1Security';
import type { v1SecurityWithListing } from '../models/v1SecurityWithListing';
import type { v1UpsertListingRequest } from '../models/v1UpsertListingRequest';
import type { v1UpsertSecurityRequest } from '../models/v1UpsertSecurityRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class TradingServiceService {
    /**
     * @returns v1ListActuariesResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceListActuaries({
        emailQuery,
        nameQuery,
        type = 'ACTUARY_TYPE_UNSPECIFIED',
        page,
        pageSize,
    }: {
        emailQuery?: string,
        nameQuery?: string,
        type?: 'ACTUARY_TYPE_UNSPECIFIED' | 'ACTUARY_TYPE_SUPERVISOR' | 'ACTUARY_TYPE_AGENT',
        page?: number,
        pageSize?: number,
    }): CancelablePromise<v1ListActuariesResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/actuaries',
            query: {
                'emailQuery': emailQuery,
                'nameQuery': nameQuery,
                'type': type,
                'page': page,
                'pageSize': pageSize,
            },
        });
    }
    /**
     * RunDailyResetActuaries is exposed for manual triggers; the same
     * codepath runs nightly at 23:59 (Belgrade) via the trading cron.
     * @returns v1RunDailyResetActuariesResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceRunDailyResetActuaries({
        body,
    }: {
        body: any,
    }): CancelablePromise<v1RunDailyResetActuariesResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/actuaries/reset-job',
            body: body,
        });
    }
    /**
     * @returns v1ActuaryInfo A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceGetActuaryInfo({
        employeeId,
    }: {
        employeeId: string,
    }): CancelablePromise<v1ActuaryInfo | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/actuaries/{employeeId}',
            path: {
                'employeeId': employeeId,
            },
        });
    }
    /**
     * @returns v1ActuaryInfo A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceUpsertActuaryInfo({
        employeeId,
        body,
    }: {
        employeeId: string,
        body: TradingServiceUpsertActuaryInfoBody,
    }): CancelablePromise<v1ActuaryInfo | rpcStatus> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/actuaries/{employeeId}',
            path: {
                'employeeId': employeeId,
            },
            body: body,
        });
    }
    /**
     * @returns v1ActuaryInfo A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceUpdateActuaryLimit({
        employeeId,
        body,
    }: {
        employeeId: string,
        body: TradingServiceUpdateActuaryLimitBody,
    }): CancelablePromise<v1ActuaryInfo | rpcStatus> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/actuaries/{employeeId}/limit',
            path: {
                'employeeId': employeeId,
            },
            body: body,
        });
    }
    /**
     * @returns v1ActuaryInfo A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceSetActuaryNeedApproval({
        employeeId,
        body,
    }: {
        employeeId: string,
        body: TradingServiceSetActuaryNeedApprovalBody,
    }): CancelablePromise<v1ActuaryInfo | rpcStatus> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/actuaries/{employeeId}/need-approval',
            path: {
                'employeeId': employeeId,
            },
            body: body,
        });
    }
    /**
     * @returns v1ActuaryInfo A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceResetActuaryUsedLimit({
        employeeId,
        body,
    }: {
        employeeId: string,
        body: TradingServiceResetActuaryUsedLimitBody,
    }): CancelablePromise<v1ActuaryInfo | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/actuaries/{employeeId}/used-limit/reset',
            path: {
                'employeeId': employeeId,
            },
            body: body,
        });
    }
    /**
     * @returns v1ListExchangesResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceListExchanges(): CancelablePromise<v1ListExchangesResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/exchanges',
        });
    }
    /**
     * @returns v1Exchange A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceUpsertExchange({
        mic,
        body,
    }: {
        mic: string,
        body: TradingServiceUpsertExchangeBody,
    }): CancelablePromise<v1Exchange | rpcStatus> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/exchanges/{mic}',
            path: {
                'mic': mic,
            },
            body: body,
        });
    }
    /**
     * @returns v1Exchange A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceSetExchangeOverride({
        mic,
        body,
    }: {
        mic: string,
        body: TradingServiceSetExchangeOverrideBody,
    }): CancelablePromise<v1Exchange | rpcStatus> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/exchanges/{mic}/override',
            path: {
                'mic': mic,
            },
            body: body,
        });
    }
    /**
     * @returns v1ListListingsResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceListListings({
        type = 'SECURITY_TYPE_UNSPECIFIED',
        exchangeMic,
        search,
        sortBy,
        sortDesc,
        page,
        pageSize,
    }: {
        type?: 'SECURITY_TYPE_UNSPECIFIED' | 'SECURITY_TYPE_STOCK' | 'SECURITY_TYPE_FUTURE' | 'SECURITY_TYPE_FOREX' | 'SECURITY_TYPE_OPTION',
        exchangeMic?: string,
        search?: string,
        /**
         * "price" / "volume" / "maintenance_margin"
         */
        sortBy?: string,
        sortDesc?: boolean,
        page?: number,
        pageSize?: number,
    }): CancelablePromise<v1ListListingsResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/listings',
            query: {
                'type': type,
                'exchangeMic': exchangeMic,
                'search': search,
                'sortBy': sortBy,
                'sortDesc': sortDesc,
                'page': page,
                'pageSize': pageSize,
            },
        });
    }
    /**
     * @returns v1Listing A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceUpsertListing({
        body,
    }: {
        body: v1UpsertListingRequest,
    }): CancelablePromise<v1Listing | rpcStatus> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/listings',
            body: body,
        });
    }
    /**
     * @returns v1Listing A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceGetListing({
        id,
    }: {
        id: string,
    }): CancelablePromise<v1Listing | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/listings/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns v1GetListingDailyHistoryResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceGetListingDailyHistory({
        listingId,
        from,
        to,
    }: {
        listingId: string,
        from?: string,
        to?: string,
    }): CancelablePromise<v1GetListingDailyHistoryResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/listings/{listingId}/history',
            path: {
                'listingId': listingId,
            },
            query: {
                'from': from,
                'to': to,
            },
        });
    }
    /**
     * @returns v1ListOrdersResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceListOrders({
        status,
        userKind = 'USER_KIND_UNSPECIFIED',
        userId,
        securityId,
        page,
        pageSize,
    }: {
        /**
         * status: "all", "pending", "approved", "declined", "done".
         */
        status?: string,
        /**
         * employee/client filter (supervisor view)
         */
        userKind?: 'USER_KIND_UNSPECIFIED' | 'USER_KIND_CLIENT' | 'USER_KIND_EMPLOYEE',
        /**
         * narrow to a single trader
         */
        userId?: string,
        securityId?: string,
        page?: number,
        pageSize?: number,
    }): CancelablePromise<v1ListOrdersResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/orders',
            query: {
                'status': status,
                'userKind': userKind,
                'userId': userId,
                'securityId': securityId,
                'page': page,
                'pageSize': pageSize,
            },
        });
    }
    /**
     * @returns v1CreateOrderResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceCreateOrder({
        body,
    }: {
        body: v1CreateOrderRequest,
    }): CancelablePromise<v1CreateOrderResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/orders',
            body: body,
        });
    }
    /**
     * @returns v1Order A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceGetOrder({
        id,
    }: {
        id: string,
    }): CancelablePromise<v1Order | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/orders/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns v1Order A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceApproveOrder({
        id,
        body,
    }: {
        id: string,
        body: TradingServiceApproveOrderBody,
    }): CancelablePromise<v1Order | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/orders/{id}/approve',
            path: {
                'id': id,
            },
            body: body,
        });
    }
    /**
     * @returns v1Order A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceCancelOrder({
        id,
        body,
    }: {
        id: string,
        body: TradingServiceCancelOrderBody,
    }): CancelablePromise<v1Order | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/orders/{id}/cancel',
            path: {
                'id': id,
            },
            body: body,
        });
    }
    /**
     * @returns v1Order A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceDeclineOrder({
        id,
        body,
    }: {
        id: string,
        body: TradingServiceDeclineOrderBody,
    }): CancelablePromise<v1Order | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/orders/{id}/decline',
            path: {
                'id': id,
            },
            body: body,
        });
    }
    /**
     * @returns v1ListHoldingsResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceListHoldings({
        userId,
        userKind = 'USER_KIND_UNSPECIFIED',
        type = 'SECURITY_TYPE_UNSPECIFIED',
    }: {
        /**
         * For supervisor view; clients/agents see only their own.
         */
        userId?: string,
        userKind?: 'USER_KIND_UNSPECIFIED' | 'USER_KIND_CLIENT' | 'USER_KIND_EMPLOYEE',
        type?: 'SECURITY_TYPE_UNSPECIFIED' | 'SECURITY_TYPE_STOCK' | 'SECURITY_TYPE_FUTURE' | 'SECURITY_TYPE_FOREX' | 'SECURITY_TYPE_OPTION',
    }): CancelablePromise<v1ListHoldingsResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/portfolio',
            query: {
                'userId': userId,
                'userKind': userKind,
                'type': type,
            },
        });
    }
    /**
     * ExerciseOption is spec p.61.d — actuaries may exercise an in-the-
     * money option before settlementDate. Result tells the FE the
     * remaining option position + the underlying-side effect.
     * @returns v1ExerciseOptionResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceExerciseOption({
        holdingId,
        body,
    }: {
        holdingId: string,
        body: TradingServiceExerciseOptionBody,
    }): CancelablePromise<v1ExerciseOptionResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/portfolio/{holdingId}/exercise',
            path: {
                'holdingId': holdingId,
            },
            body: body,
        });
    }
    /**
     * @returns v1Holding A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceSetPublicCount({
        id,
        body,
    }: {
        id: string,
        body: TradingServiceSetPublicCountBody,
    }): CancelablePromise<v1Holding | rpcStatus> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/portfolio/{id}/public-count',
            path: {
                'id': id,
            },
            body: body,
        });
    }
    /**
     * @returns v1ListSecuritiesResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceListSecurities({
        type = 'SECURITY_TYPE_UNSPECIFIED',
        search,
        exchangeMic,
        minPrice,
        maxPrice,
        minAsk,
        maxAsk,
        minBid,
        maxBid,
        minVolume,
        maxVolume,
        minSettlement,
        maxSettlement,
        sortBy,
        sortDesc,
        page,
        pageSize,
    }: {
        type?: 'SECURITY_TYPE_UNSPECIFIED' | 'SECURITY_TYPE_STOCK' | 'SECURITY_TYPE_FUTURE' | 'SECURITY_TYPE_FOREX' | 'SECURITY_TYPE_OPTION',
        /**
         * ticker/name substring
         */
        search?: string,
        exchangeMic?: string,
        /**
         * Optional range filters; empty strings mean unbounded.
         */
        minPrice?: string,
        maxPrice?: string,
        minAsk?: string,
        maxAsk?: string,
        minBid?: string,
        maxBid?: string,
        minVolume?: string,
        maxVolume?: string,
        /**
         * For futures/options: settlement-date range.
         */
        minSettlement?: string,
        maxSettlement?: string,
        /**
         * Sort by "price", "volume", "maintenance_margin".
         */
        sortBy?: string,
        sortDesc?: boolean,
        page?: number,
        pageSize?: number,
    }): CancelablePromise<v1ListSecuritiesResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/securities',
            query: {
                'type': type,
                'search': search,
                'exchangeMic': exchangeMic,
                'minPrice': minPrice,
                'maxPrice': maxPrice,
                'minAsk': minAsk,
                'maxAsk': maxAsk,
                'minBid': minBid,
                'maxBid': maxBid,
                'minVolume': minVolume,
                'maxVolume': maxVolume,
                'minSettlement': minSettlement,
                'maxSettlement': maxSettlement,
                'sortBy': sortBy,
                'sortDesc': sortDesc,
                'page': page,
                'pageSize': pageSize,
            },
        });
    }
    /**
     * @returns v1Security A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceUpsertSecurity({
        body,
    }: {
        body: v1UpsertSecurityRequest,
    }): CancelablePromise<v1Security | rpcStatus> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/securities',
            body: body,
        });
    }
    /**
     * @returns v1SecurityWithListing A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceGetSecurity({
        id,
    }: {
        id: string,
    }): CancelablePromise<v1SecurityWithListing | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/securities/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * GetOptionChain returns the option chain for a stock — call/put
     * pairs grouped by strike, filtered to the N rows nearest the
     * shared (current) price per spec p.59.
     * @returns v1GetOptionChainResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceGetOptionChain({
        stockId,
        settlementDate,
        strikesWindow,
    }: {
        stockId: string,
        /**
         * Settlement date filter; if unset, returns all chains.
         */
        settlementDate?: string,
        /**
         * strikes_window: number of strike rows above and below the at-the-
         * money strike to return (spec p.59 "filter po broju strike-ova").
         */
        strikesWindow?: number,
    }): CancelablePromise<v1GetOptionChainResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/securities/{stockId}/option-chain',
            path: {
                'stockId': stockId,
            },
            query: {
                'settlementDate': settlementDate,
                'strikesWindow': strikesWindow,
            },
        });
    }
    /**
     * @returns v1ListTaxPositionsResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceListTaxPositions({
        userKind = 'USER_KIND_UNSPECIFIED',
        nameQuery,
    }: {
        userKind?: 'USER_KIND_UNSPECIFIED' | 'USER_KIND_CLIENT' | 'USER_KIND_EMPLOYEE',
        nameQuery?: string,
    }): CancelablePromise<v1ListTaxPositionsResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/tax/positions',
            query: {
                'userKind': userKind,
                'nameQuery': nameQuery,
            },
        });
    }
    /**
     * @returns v1ListRealizedPnLResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceListRealizedPnL({
        userId,
        userKind = 'USER_KIND_UNSPECIFIED',
        from,
        to,
    }: {
        userId?: string,
        userKind?: 'USER_KIND_UNSPECIFIED' | 'USER_KIND_CLIENT' | 'USER_KIND_EMPLOYEE',
        from?: string,
        to?: string,
    }): CancelablePromise<v1ListRealizedPnLResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/tax/realized',
            query: {
                'userId': userId,
                'userKind': userKind,
                'from': from,
                'to': to,
            },
        });
    }
    /**
     * @returns v1RunTaxResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceRunTax({
        body,
    }: {
        body: v1RunTaxRequest,
    }): CancelablePromise<v1RunTaxResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/tax/run',
            body: body,
        });
    }
}
