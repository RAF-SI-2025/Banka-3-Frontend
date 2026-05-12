/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { rpcStatus } from '../models/rpcStatus';
import type { TradingServiceAcceptOTCOfferBody } from '../models/TradingServiceAcceptOTCOfferBody';
import type { TradingServiceApproveOrderBody } from '../models/TradingServiceApproveOrderBody';
import type { TradingServiceCancelOrderBody } from '../models/TradingServiceCancelOrderBody';
import type { TradingServiceCounterOfferOTCBody } from '../models/TradingServiceCounterOfferOTCBody';
import type { TradingServiceDeclineOrderBody } from '../models/TradingServiceDeclineOrderBody';
import type { TradingServiceExerciseOptionBody } from '../models/TradingServiceExerciseOptionBody';
import type { TradingServiceExerciseOTCContractBody } from '../models/TradingServiceExerciseOTCContractBody';
import type { TradingServiceInvestInFundBody } from '../models/TradingServiceInvestInFundBody';
import type { TradingServiceResetActuaryUsedLimitBody } from '../models/TradingServiceResetActuaryUsedLimitBody';
import type { TradingServiceSetActuaryNeedApprovalBody } from '../models/TradingServiceSetActuaryNeedApprovalBody';
import type { TradingServiceSetExchangeOverrideBody } from '../models/TradingServiceSetExchangeOverrideBody';
import type { TradingServiceSetPublicCountBody } from '../models/TradingServiceSetPublicCountBody';
import type { TradingServiceUpdateActuaryLimitBody } from '../models/TradingServiceUpdateActuaryLimitBody';
import type { TradingServiceUpsertActuaryInfoBody } from '../models/TradingServiceUpsertActuaryInfoBody';
import type { TradingServiceUpsertExchangeBody } from '../models/TradingServiceUpsertExchangeBody';
import type { TradingServiceWithdrawFromFundBody } from '../models/TradingServiceWithdrawFromFundBody';
import type { TradingServiceWithdrawOTCOfferBody } from '../models/TradingServiceWithdrawOTCOfferBody';
import type { v1AcceptOTCOfferResponse } from '../models/v1AcceptOTCOfferResponse';
import type { v1ActuaryInfo } from '../models/v1ActuaryInfo';
import type { v1CreateFundRequest } from '../models/v1CreateFundRequest';
import type { v1CreateOrderRequest } from '../models/v1CreateOrderRequest';
import type { v1CreateOrderResponse } from '../models/v1CreateOrderResponse';
import type { v1CreateOTCOfferRequest } from '../models/v1CreateOTCOfferRequest';
import type { v1Exchange } from '../models/v1Exchange';
import type { v1ExerciseOptionResponse } from '../models/v1ExerciseOptionResponse';
import type { v1ExerciseOTCContractResponse } from '../models/v1ExerciseOTCContractResponse';
import type { v1Fund } from '../models/v1Fund';
import type { v1FundTransactionResponse } from '../models/v1FundTransactionResponse';
import type { v1GetFundPerformanceResponse } from '../models/v1GetFundPerformanceResponse';
import type { v1GetFundResponse } from '../models/v1GetFundResponse';
import type { v1GetListingDailyHistoryResponse } from '../models/v1GetListingDailyHistoryResponse';
import type { v1GetOptionChainResponse } from '../models/v1GetOptionChainResponse';
import type { v1GetOTCThreadResponse } from '../models/v1GetOTCThreadResponse';
import type { v1Holding } from '../models/v1Holding';
import type { v1ListActuariesResponse } from '../models/v1ListActuariesResponse';
import type { v1ListActuaryPerformancesResponse } from '../models/v1ListActuaryPerformancesResponse';
import type { v1ListBankFundPositionsResponse } from '../models/v1ListBankFundPositionsResponse';
import type { v1ListExchangesResponse } from '../models/v1ListExchangesResponse';
import type { v1ListFundPositionsResponse } from '../models/v1ListFundPositionsResponse';
import type { v1ListFundsResponse } from '../models/v1ListFundsResponse';
import type { v1ListFundTransactionsResponse } from '../models/v1ListFundTransactionsResponse';
import type { v1ListHoldingsResponse } from '../models/v1ListHoldingsResponse';
import type { v1Listing } from '../models/v1Listing';
import type { v1ListListingsResponse } from '../models/v1ListListingsResponse';
import type { v1ListOrdersResponse } from '../models/v1ListOrdersResponse';
import type { v1ListOTCContractsResponse } from '../models/v1ListOTCContractsResponse';
import type { v1ListOTCThreadsResponse } from '../models/v1ListOTCThreadsResponse';
import type { v1ListPublicHoldingsResponse } from '../models/v1ListPublicHoldingsResponse';
import type { v1ListRealizedPnLResponse } from '../models/v1ListRealizedPnLResponse';
import type { v1ListSecuritiesResponse } from '../models/v1ListSecuritiesResponse';
import type { v1ListTaxPositionsResponse } from '../models/v1ListTaxPositionsResponse';
import type { v1Order } from '../models/v1Order';
import type { v1OTCContract } from '../models/v1OTCContract';
import type { v1OTCOffer } from '../models/v1OTCOffer';
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
     * ListFunds returns the fund discovery list (spec p.71). Supervisors
     * and clients with funds.read.* can browse; rows include total_value,
     * profit, and minimum_contribution for sorting/filtering.
     * @returns v1ListFundsResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceListFunds({
        status,
        managerUserId,
        minContributionAtLeast,
        minContributionAtMost,
        sort,
        order,
    }: {
        /**
         * status: "active" (default), "any".
         */
        status?: string,
        /**
         * Filter by manager (supervisor view).
         */
        managerUserId?: string,
        /**
         * Filter by minimum_contribution range (RSD, decimal strings).
         * Empty disables the bound.
         */
        minContributionAtLeast?: string,
        minContributionAtMost?: string,
        /**
         * Sort: "name" (default), "total_value", "profit", "minimum_contribution".
         */
        sort?: string,
        /**
         * "asc" (default) or "desc".
         */
        order?: string,
    }): CancelablePromise<v1ListFundsResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/funds',
            query: {
                'status': status,
                'managerUserId': managerUserId,
                'minContributionAtLeast': minContributionAtLeast,
                'minContributionAtMost': minContributionAtMost,
                'sort': sort,
                'order': order,
            },
        });
    }
    /**
     * CreateFund mints a new fund (supervisor only — spec p.74). Bank
     * service is called internally to open the fund's RSD account; the
     * creator becomes the default manager.
     * @returns v1Fund A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceCreateFund({
        body,
    }: {
        body: v1CreateFundRequest,
    }): CancelablePromise<v1Fund | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/funds',
            body: body,
        });
    }
    /**
     * ListFundPositions returns the caller's positions across all funds
     * (clients) or a specified user's (supervisors/admin). Supervisors
     * may pass the BankAsClient sentinel UUID to see the bank's stakes
     * (FE-FUND-6, Profit Banke "Bank fund positions").
     * @returns v1ListFundPositionsResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceListFundPositions({
        clientId,
        status,
    }: {
        /**
         * Empty client_id = caller's own positions. Supervisors/admin may
         * narrow to a specific client (or to the BankAsClient sentinel for
         * Profit Banke).
         */
        clientId?: string,
        /**
         * status: "active" (default, units > 0), "any".
         */
        status?: string,
    }): CancelablePromise<v1ListFundPositionsResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/funds/positions',
            query: {
                'clientId': clientId,
                'status': status,
            },
        });
    }
    /**
     * GetFund returns the fund detail including its holdings list and the
     * caller's position when one exists. Spec p.74.
     * @returns v1GetFundResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceGetFund({
        id,
    }: {
        id: string,
    }): CancelablePromise<v1GetFundResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/funds/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * InvestInFund runs the fund_invest SAGA: reserves the source
     * account, transfers to the fund's bank account (FX hop if needed),
     * upserts the client_fund_positions row (units math) and writes a
     * client_fund_transactions row. Verification-gated (FOUND-9).
     * @returns v1FundTransactionResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceInvestInFund({
        id,
        body,
    }: {
        id: string,
        body: TradingServiceInvestInFundBody,
    }): CancelablePromise<v1FundTransactionResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/funds/{id}/invest',
            path: {
                'id': id,
            },
            body: body,
        });
    }
    /**
     * GetFundPerformance returns the daily liquid_rsd + holdings_value_rsd
     * time series for a fund. FE-FUND-2 chart.
     * @returns v1GetFundPerformanceResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceGetFundPerformance({
        id,
        days,
    }: {
        id: string,
        /**
         * Sliding window: defaults to 30d when zero.
         */
        days?: number,
    }): CancelablePromise<v1GetFundPerformanceResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/funds/{id}/performance',
            path: {
                'id': id,
            },
            query: {
                'days': days,
            },
        });
    }
    /**
     * ListFundTransactions returns the audit log of invest/withdraw rows
     * for a fund. Supervisors see everything; clients see only their own.
     * @returns v1ListFundTransactionsResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceListFundTransactions({
        id,
        clientId,
        status,
        page,
        pageSize,
    }: {
        id: string,
        /**
         * narrow when caller is supervisor
         */
        clientId?: string,
        /**
         * "" / "pending" / "completed" / "failed"
         */
        status?: string,
        page?: number,
        pageSize?: number,
    }): CancelablePromise<v1ListFundTransactionsResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/funds/{id}/transactions',
            path: {
                'id': id,
            },
            query: {
                'clientId': clientId,
                'status': status,
                'page': page,
                'pageSize': pageSize,
            },
        });
    }
    /**
     * WithdrawFromFund runs the fund_withdraw SAGA. Liquid path (fund
     * has enough RSD on its bank account) reserves and transfers
     * directly; illiquid path stays in `pending` while auto-liquidation
     * orders settle the gap. Verification-gated.
     * @returns v1FundTransactionResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceWithdrawFromFund({
        id,
        body,
    }: {
        id: string,
        body: TradingServiceWithdrawFromFundBody,
    }): CancelablePromise<v1FundTransactionResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/funds/{id}/withdraw',
            path: {
                'id': id,
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
         *
         * - USER_KIND_FUND: USER_KIND_FUND identifies investment-fund-as-actor rows (c4 PR3,
         * spec p.74-75). A fund-actor order's user_id is the fund's id; its
         * settlement account is the fund's bank account. Fund-actor sells do
         * not write realized_gains rows — funds are pre-tax vehicles; tax
         * attaches to the client at withdrawal time (EDGE-3).
         */
        userKind?: 'USER_KIND_UNSPECIFIED' | 'USER_KIND_CLIENT' | 'USER_KIND_EMPLOYEE' | 'USER_KIND_FUND',
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
     * ListOTCContracts drives the "Sklopljeni ugovori" page (spec p.69)
     * for the caller. Supervisors/admin may filter by user_id.
     * @returns v1ListOTCContractsResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceListOtcContracts({
        partyUserId,
        partyUserKind = 'USER_KIND_UNSPECIFIED',
        status,
    }: {
        /**
         * Supervisor/admin: empty user_id returns all; non-empty narrows.
         */
        partyUserId?: string,
        /**
         *  - USER_KIND_FUND: USER_KIND_FUND identifies investment-fund-as-actor rows (c4 PR3,
         * spec p.74-75). A fund-actor order's user_id is the fund's id; its
         * settlement account is the fund's bank account. Fund-actor sells do
         * not write realized_gains rows — funds are pre-tax vehicles; tax
         * attaches to the client at withdrawal time (EDGE-3).
         */
        partyUserKind?: 'USER_KIND_UNSPECIFIED' | 'USER_KIND_CLIENT' | 'USER_KIND_EMPLOYEE' | 'USER_KIND_FUND',
        /**
         * "active"/"any"/"" (default "active").
         */
        status?: string,
    }): CancelablePromise<v1ListOTCContractsResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/otc/contracts',
            query: {
                'partyUserId': partyUserId,
                'partyUserKind': partyUserKind,
                'status': status,
            },
        });
    }
    /**
     * GetOTCContract returns one contract (caller must be a party or
     * supervisor/admin).
     * @returns v1OTCContract A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceGetOtcContract({
        id,
    }: {
        id: string,
    }): CancelablePromise<v1OTCContract | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/otc/contracts/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * ExerciseOTCContract runs the otc_exercise SAGA on an active
     * contract (spec p.80 intra-bank): buyer pays qty * strike to seller,
     * shares transfer, contract flips to `exercised`. Buyer's cost basis
     * on the received shares is `strike_price`; seller writes a
     * realized_gains row.
     * @returns v1ExerciseOTCContractResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceExerciseOtcContract({
        id,
        body,
    }: {
        id: string,
        body: TradingServiceExerciseOTCContractBody,
    }): CancelablePromise<v1ExerciseOTCContractResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/otc/contracts/{id}/exercise',
            path: {
                'id': id,
            },
            body: body,
        });
    }
    /**
     * ListPublicHoldings drives the OTC discovery board (spec p.67):
     * holdings owned by other users that have public_count > reserved_count
     * are visible. Filterable by ticker.
     * @returns v1ListPublicHoldingsResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceListPublicHoldings({
        ticker,
    }: {
        ticker?: string,
    }): CancelablePromise<v1ListPublicHoldingsResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/otc/discovery',
            query: {
                'ticker': ticker,
            },
        });
    }
    /**
     * ListOTCThreads drives the "Aktivne ponude" page (spec p.69) — every
     * thread the caller participates in (as buyer or seller), most-recent
     * iteration per thread.
     * @returns v1ListOTCThreadsResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceListOtcThreads({
        partyUserId,
        partyUserKind = 'USER_KIND_UNSPECIFIED',
        status,
    }: {
        /**
         * For supervisor/admin views — narrow to a single party. Empty for
         * self.
         */
        partyUserId?: string,
        /**
         *  - USER_KIND_FUND: USER_KIND_FUND identifies investment-fund-as-actor rows (c4 PR3,
         * spec p.74-75). A fund-actor order's user_id is the fund's id; its
         * settlement account is the fund's bank account. Fund-actor sells do
         * not write realized_gains rows — funds are pre-tax vehicles; tax
         * attaches to the client at withdrawal time (EDGE-3).
         */
        partyUserKind?: 'USER_KIND_UNSPECIFIED' | 'USER_KIND_CLIENT' | 'USER_KIND_EMPLOYEE' | 'USER_KIND_FUND',
        /**
         * "open" / "any" / "" (default "open").
         */
        status?: string,
    }): CancelablePromise<v1ListOTCThreadsResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/otc/offers',
            query: {
                'partyUserId': partyUserId,
                'partyUserKind': partyUserKind,
                'status': status,
            },
        });
    }
    /**
     * CreateOTCOffer opens a new negotiation thread. The buyer initiates;
     * the seller_holding_id resolves the seller (its owner). Increments
     * reserved_count on the seller's holding by quantity.
     * @returns v1OTCOffer A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceCreateOtcOffer({
        body,
    }: {
        body: v1CreateOTCOfferRequest,
    }): CancelablePromise<v1OTCOffer | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/otc/offers',
            body: body,
        });
    }
    /**
     * GetOTCThread returns every iteration in a thread (oldest first).
     * Drives the thread-detail modal on spec p.69.
     * @returns v1GetOTCThreadResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceGetOtcThread({
        threadId,
    }: {
        threadId: string,
    }): CancelablePromise<v1GetOTCThreadResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/otc/offers/{threadId}',
            path: {
                'threadId': threadId,
            },
        });
    }
    /**
     * AcceptOTCOffer accepts the open iteration in a thread and mints
     * an active contract via the otc_premium SAGA (premium transfers
     * from buyer to seller; contract row is created; seller's holding
     * reservation rolls over from offer to contract).
     * @returns v1AcceptOTCOfferResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceAcceptOtcOffer({
        threadId,
        body,
    }: {
        threadId: string,
        body: TradingServiceAcceptOTCOfferBody,
    }): CancelablePromise<v1AcceptOTCOfferResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/otc/offers/{threadId}/accept',
            path: {
                'threadId': threadId,
            },
            body: body,
        });
    }
    /**
     * CounterOfferOTC appends a new iteration to an existing thread. The
     * prior open row flips to `superseded`; reservation is adjusted if
     * quantity changed. modified_by tracks which party last touched the
     * thread (drives the FE unread badge).
     * @returns v1OTCOffer A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceCounterOfferOtc({
        threadId,
        body,
    }: {
        threadId: string,
        body: TradingServiceCounterOfferOTCBody,
    }): CancelablePromise<v1OTCOffer | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/otc/offers/{threadId}/counter',
            path: {
                'threadId': threadId,
            },
            body: body,
        });
    }
    /**
     * WithdrawOTCOffer pulls a thread out of negotiation. Either party
     * may call; the open row flips to `withdrawn` and the seller's
     * reservation is released.
     * @returns v1OTCOffer A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceWithdrawOtcOffer({
        threadId,
        body,
    }: {
        threadId: string,
        body: TradingServiceWithdrawOTCOfferBody,
    }): CancelablePromise<v1OTCOffer | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/otc/offers/{threadId}/withdraw',
            path: {
                'threadId': threadId,
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
        /**
         *  - USER_KIND_FUND: USER_KIND_FUND identifies investment-fund-as-actor rows (c4 PR3,
         * spec p.74-75). A fund-actor order's user_id is the fund's id; its
         * settlement account is the fund's bank account. Fund-actor sells do
         * not write realized_gains rows — funds are pre-tax vehicles; tax
         * attaches to the client at withdrawal time (EDGE-3).
         */
        userKind?: 'USER_KIND_UNSPECIFIED' | 'USER_KIND_CLIENT' | 'USER_KIND_EMPLOYEE' | 'USER_KIND_FUND',
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
     * @returns v1ListActuaryPerformancesResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceListActuaryPerformances({
        type,
        nameQuery,
    }: {
        /**
         * "agent" / "supervisor" / "" (default both). Mirrors actuary_info.type.
         */
        type?: string,
        nameQuery?: string,
    }): CancelablePromise<v1ListActuaryPerformancesResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/profit/actuaries',
            query: {
                'type': type,
                'nameQuery': nameQuery,
            },
        });
    }
    /**
     * @returns v1ListBankFundPositionsResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static tradingServiceListBankFundPositions(): CancelablePromise<v1ListBankFundPositionsResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/profit/funds',
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
        /**
         *  - USER_KIND_FUND: USER_KIND_FUND identifies investment-fund-as-actor rows (c4 PR3,
         * spec p.74-75). A fund-actor order's user_id is the fund's id; its
         * settlement account is the fund's bank account. Fund-actor sells do
         * not write realized_gains rows — funds are pre-tax vehicles; tax
         * attaches to the client at withdrawal time (EDGE-3).
         */
        userKind?: 'USER_KIND_UNSPECIFIED' | 'USER_KIND_CLIENT' | 'USER_KIND_EMPLOYEE' | 'USER_KIND_FUND',
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
        /**
         *  - USER_KIND_FUND: USER_KIND_FUND identifies investment-fund-as-actor rows (c4 PR3,
         * spec p.74-75). A fund-actor order's user_id is the fund's id; its
         * settlement account is the fund's bank account. Fund-actor sells do
         * not write realized_gains rows — funds are pre-tax vehicles; tax
         * attaches to the client at withdrawal time (EDGE-3).
         */
        userKind?: 'USER_KIND_UNSPECIFIED' | 'USER_KIND_CLIENT' | 'USER_KIND_EMPLOYEE' | 'USER_KIND_FUND',
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
