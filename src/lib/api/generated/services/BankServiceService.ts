/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BankServiceDecideLoanRequestBody } from '../models/BankServiceDecideLoanRequestBody';
import type { BankServiceSetAccountStatusBody } from '../models/BankServiceSetAccountStatusBody';
import type { BankServiceSetCardStatusBody } from '../models/BankServiceSetCardStatusBody';
import type { BankServiceUpdateAccountLimitsBody } from '../models/BankServiceUpdateAccountLimitsBody';
import type { BankServiceUpdateAccountNameBody } from '../models/BankServiceUpdateAccountNameBody';
import type { BankServiceUpdateCardLimitBody } from '../models/BankServiceUpdateCardLimitBody';
import type { BankServiceUpdateCompanyBody } from '../models/BankServiceUpdateCompanyBody';
import type { BankServiceUpdatePaymentRecipientBody } from '../models/BankServiceUpdatePaymentRecipientBody';
import type { rpcStatus } from '../models/rpcStatus';
import type { v1Account } from '../models/v1Account';
import type { v1AuthorizedPerson } from '../models/v1AuthorizedPerson';
import type { v1Card } from '../models/v1Card';
import type { v1Company } from '../models/v1Company';
import type { v1CreateAccountRequest } from '../models/v1CreateAccountRequest';
import type { v1CreateAuthorizedPersonRequest } from '../models/v1CreateAuthorizedPersonRequest';
import type { v1CreateCardRequest } from '../models/v1CreateCardRequest';
import type { v1CreateCompanyRequest } from '../models/v1CreateCompanyRequest';
import type { v1CreatePaymentRecipientRequest } from '../models/v1CreatePaymentRecipientRequest';
import type { v1CreatePaymentRequest } from '../models/v1CreatePaymentRequest';
import type { v1CreateTransferRequest } from '../models/v1CreateTransferRequest';
import type { v1ListAccountsResponse } from '../models/v1ListAccountsResponse';
import type { v1ListAuthorizedPersonsResponse } from '../models/v1ListAuthorizedPersonsResponse';
import type { v1ListCardsResponse } from '../models/v1ListCardsResponse';
import type { v1ListCompaniesResponse } from '../models/v1ListCompaniesResponse';
import type { v1ListLoanRequestsResponse } from '../models/v1ListLoanRequestsResponse';
import type { v1ListLoansResponse } from '../models/v1ListLoansResponse';
import type { v1ListPaymentRecipientsResponse } from '../models/v1ListPaymentRecipientsResponse';
import type { v1ListTransactionsResponse } from '../models/v1ListTransactionsResponse';
import type { v1LoanRequest } from '../models/v1LoanRequest';
import type { v1LoanWithInstallments } from '../models/v1LoanWithInstallments';
import type { v1PaymentRecipient } from '../models/v1PaymentRecipient';
import type { v1PaymentResult } from '../models/v1PaymentResult';
import type { v1QuoteExchangeRequest } from '../models/v1QuoteExchangeRequest';
import type { v1QuoteExchangeResponse } from '../models/v1QuoteExchangeResponse';
import type { v1RunInstallmentJobRequest } from '../models/v1RunInstallmentJobRequest';
import type { v1RunInstallmentJobResponse } from '../models/v1RunInstallmentJobResponse';
import type { v1RunVariableRateJobRequest } from '../models/v1RunVariableRateJobRequest';
import type { v1RunVariableRateJobResponse } from '../models/v1RunVariableRateJobResponse';
import type { v1SubmitLoanRequestRequest } from '../models/v1SubmitLoanRequestRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class BankServiceService {
    /**
     * @returns v1ListAccountsResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceListAccounts({
        ownerClientId,
        kind = 'ACCOUNT_KIND_UNSPECIFIED',
        currency = 'CURRENCY_UNSPECIFIED',
        status = 'ACCOUNT_STATUS_UNSPECIFIED',
        page,
        pageSize,
    }: {
        ownerClientId?: string,
        /**
         *  - ACCOUNT_KIND_PERSONAL_CHECKING_RSD: lični tekući RSD  (TT=11/13/14/15/16/17 by subtype)
         * - ACCOUNT_KIND_PERSONAL_FX: lični devizni     (TT=21)
         * - ACCOUNT_KIND_BUSINESS_CHECKING_RSD: poslovni tekući   (TT=12)
         * - ACCOUNT_KIND_BUSINESS_FX: poslovni devizni  (TT=22)
         * - ACCOUNT_KIND_SYSTEM: bank-owned house  (TT=99, internal)
         * - ACCOUNT_KIND_FOREX_BOOK: bank's per-currency FX inventory book (internal, addressable for actuary trading)
         * - ACCOUNT_KIND_STATE_TAX: RSD destination for capital-gains tax remittance (internal)
         * - ACCOUNT_KIND_FUND: investment fund's liquidity account (c4 PR3, spec p.74; FundsOwnerID sentinel as owner)
         */
        kind?: 'ACCOUNT_KIND_UNSPECIFIED' | 'ACCOUNT_KIND_PERSONAL_CHECKING_RSD' | 'ACCOUNT_KIND_PERSONAL_FX' | 'ACCOUNT_KIND_BUSINESS_CHECKING_RSD' | 'ACCOUNT_KIND_BUSINESS_FX' | 'ACCOUNT_KIND_SYSTEM' | 'ACCOUNT_KIND_FOREX_BOOK' | 'ACCOUNT_KIND_STATE_TAX' | 'ACCOUNT_KIND_FUND',
        currency?: 'CURRENCY_UNSPECIFIED' | 'CURRENCY_RSD' | 'CURRENCY_EUR' | 'CURRENCY_CHF' | 'CURRENCY_USD' | 'CURRENCY_GBP' | 'CURRENCY_JPY' | 'CURRENCY_CAD' | 'CURRENCY_AUD',
        status?: 'ACCOUNT_STATUS_UNSPECIFIED' | 'ACCOUNT_STATUS_ACTIVE' | 'ACCOUNT_STATUS_INACTIVE',
        page?: number,
        pageSize?: number,
    }): CancelablePromise<v1ListAccountsResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/accounts',
            query: {
                'ownerClientId': ownerClientId,
                'kind': kind,
                'currency': currency,
                'status': status,
                'page': page,
                'pageSize': pageSize,
            },
        });
    }
    /**
     * @returns v1Account A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceCreateAccount({
        body,
    }: {
        body: v1CreateAccountRequest,
    }): CancelablePromise<v1Account | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/accounts',
            body: body,
        });
    }
    /**
     * @returns v1Account A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceGetAccount({
        id,
    }: {
        id: string,
    }): CancelablePromise<v1Account | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/accounts/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns v1Account A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceUpdateAccountLimits({
        id,
        body,
    }: {
        id: string,
        body: BankServiceUpdateAccountLimitsBody,
    }): CancelablePromise<v1Account | rpcStatus> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/accounts/{id}/limits',
            path: {
                'id': id,
            },
            body: body,
        });
    }
    /**
     * UpdateAccountName implements spec p.20 "Promena naziva računa".
     * Only the account owner may rename. The new name must differ from
     * the current name and must not collide with another active account
     * owned by the same client. No verification gate — renaming doesn't
     * move money, and the spec p.20 popup doesn't require a code (only
     * limit changes do).
     * @returns v1Account A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceUpdateAccountName({
        id,
        body,
    }: {
        id: string,
        body: BankServiceUpdateAccountNameBody,
    }): CancelablePromise<v1Account | rpcStatus> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/accounts/{id}/name',
            path: {
                'id': id,
            },
            body: body,
        });
    }
    /**
     * @returns v1Account A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceSetAccountStatus({
        id,
        body,
    }: {
        id: string,
        body: BankServiceSetAccountStatusBody,
    }): CancelablePromise<v1Account | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/accounts/{id}/status',
            path: {
                'id': id,
            },
            body: body,
        });
    }
    /**
     * @returns v1ListAuthorizedPersonsResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceListAuthorizedPersons({
        companyId,
    }: {
        companyId?: string,
    }): CancelablePromise<v1ListAuthorizedPersonsResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/authorized-persons',
            query: {
                'companyId': companyId,
            },
        });
    }
    /**
     * @returns v1AuthorizedPerson A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceCreateAuthorizedPerson({
        body,
    }: {
        body: v1CreateAuthorizedPersonRequest,
    }): CancelablePromise<v1AuthorizedPerson | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/authorized-persons',
            body: body,
        });
    }
    /**
     * @returns v1ListCardsResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceListCards({
        accountId,
    }: {
        accountId?: string,
    }): CancelablePromise<v1ListCardsResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/cards',
            query: {
                'accountId': accountId,
            },
        });
    }
    /**
     * @returns v1Card A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceCreateCard({
        body,
    }: {
        body: v1CreateCardRequest,
    }): CancelablePromise<v1Card | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/cards',
            body: body,
        });
    }
    /**
     * UpdateCardLimit changes a card's per-card spending limit (flow.pdf
     * P6 "Klijent menja limit kartice"). Verification-gated by the
     * gateway middleware — same policy as account-limit changes.
     * @returns v1Card A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceUpdateCardLimit({
        id,
        body,
    }: {
        id: string,
        body: BankServiceUpdateCardLimitBody,
    }): CancelablePromise<v1Card | rpcStatus> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/cards/{id}/limit',
            path: {
                'id': id,
            },
            body: body,
        });
    }
    /**
     * @returns v1Card A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceSetCardStatus({
        id,
        body,
    }: {
        id: string,
        body: BankServiceSetCardStatusBody,
    }): CancelablePromise<v1Card | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/cards/{id}/status',
            path: {
                'id': id,
            },
            body: body,
        });
    }
    /**
     * @returns v1ListCompaniesResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceListCompanies({
        nameQuery,
        registryIdQuery,
        page,
        pageSize,
    }: {
        nameQuery?: string,
        registryIdQuery?: string,
        page?: number,
        pageSize?: number,
    }): CancelablePromise<v1ListCompaniesResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/companies',
            query: {
                'nameQuery': nameQuery,
                'registryIdQuery': registryIdQuery,
                'page': page,
                'pageSize': pageSize,
            },
        });
    }
    /**
     * @returns v1Company A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceCreateCompany({
        body,
    }: {
        body: v1CreateCompanyRequest,
    }): CancelablePromise<v1Company | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/companies',
            body: body,
        });
    }
    /**
     * @returns v1Company A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceGetCompany({
        id,
    }: {
        id: string,
    }): CancelablePromise<v1Company | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/companies/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns v1Company A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceUpdateCompany({
        id,
        body,
    }: {
        id: string,
        body: BankServiceUpdateCompanyBody,
    }): CancelablePromise<v1Company | rpcStatus> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/companies/{id}',
            path: {
                'id': id,
            },
            body: body,
        });
    }
    /**
     * @returns v1ListLoanRequestsResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceListLoanRequests({
        status = 'LOAN_REQUEST_STATUS_UNSPECIFIED',
        loanType = 'LOAN_TYPE_UNSPECIFIED',
        accountId,
        page,
        pageSize,
    }: {
        status?: 'LOAN_REQUEST_STATUS_UNSPECIFIED' | 'LOAN_REQUEST_STATUS_PENDING' | 'LOAN_REQUEST_STATUS_APPROVED' | 'LOAN_REQUEST_STATUS_REJECTED',
        /**
         *  - LOAN_TYPE_CASH: gotovinski / keš
         * - LOAN_TYPE_HOUSING: stambeni
         * - LOAN_TYPE_AUTO: auto
         * - LOAN_TYPE_REFINANCE: refinansirajući
         * - LOAN_TYPE_STUDENT: studentski
         */
        loanType?: 'LOAN_TYPE_UNSPECIFIED' | 'LOAN_TYPE_CASH' | 'LOAN_TYPE_HOUSING' | 'LOAN_TYPE_AUTO' | 'LOAN_TYPE_REFINANCE' | 'LOAN_TYPE_STUDENT',
        accountId?: string,
        page?: number,
        pageSize?: number,
    }): CancelablePromise<v1ListLoanRequestsResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/loan-requests',
            query: {
                'status': status,
                'loanType': loanType,
                'accountId': accountId,
                'page': page,
                'pageSize': pageSize,
            },
        });
    }
    /**
     * @returns v1LoanRequest A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceSubmitLoanRequest({
        body,
    }: {
        body: v1SubmitLoanRequestRequest,
    }): CancelablePromise<v1LoanRequest | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/loan-requests',
            body: body,
        });
    }
    /**
     * @returns v1LoanRequest A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceDecideLoanRequest({
        id,
        body,
    }: {
        id: string,
        body: BankServiceDecideLoanRequestBody,
    }): CancelablePromise<v1LoanRequest | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/loan-requests/{id}/decide',
            path: {
                'id': id,
            },
            body: body,
        });
    }
    /**
     * @returns v1ListLoansResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceListLoans({
        clientId,
        accountId,
        loanType = 'LOAN_TYPE_UNSPECIFIED',
        status = 'LOAN_STATUS_UNSPECIFIED',
        page,
        pageSize,
    }: {
        clientId?: string,
        accountId?: string,
        /**
         *  - LOAN_TYPE_CASH: gotovinski / keš
         * - LOAN_TYPE_HOUSING: stambeni
         * - LOAN_TYPE_AUTO: auto
         * - LOAN_TYPE_REFINANCE: refinansirajući
         * - LOAN_TYPE_STUDENT: studentski
         */
        loanType?: 'LOAN_TYPE_UNSPECIFIED' | 'LOAN_TYPE_CASH' | 'LOAN_TYPE_HOUSING' | 'LOAN_TYPE_AUTO' | 'LOAN_TYPE_REFINANCE' | 'LOAN_TYPE_STUDENT',
        status?: 'LOAN_STATUS_UNSPECIFIED' | 'LOAN_STATUS_APPROVED' | 'LOAN_STATUS_REJECTED' | 'LOAN_STATUS_PAID_OFF' | 'LOAN_STATUS_OVERDUE',
        page?: number,
        pageSize?: number,
    }): CancelablePromise<v1ListLoansResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/loans',
            query: {
                'clientId': clientId,
                'accountId': accountId,
                'loanType': loanType,
                'status': status,
                'page': page,
                'pageSize': pageSize,
            },
        });
    }
    /**
     * RunInstallmentJob debits any installments that are due today.
     * Normally driven by the daily cron; exposed as an RPC so tests and
     * ops can fire it on demand. Admin-only.
     * @returns v1RunInstallmentJobResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceRunInstallmentJob({
        body,
    }: {
        body: v1RunInstallmentJobRequest,
    }): CancelablePromise<v1RunInstallmentJobResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/loans/run-installment-job',
            body: body,
        });
    }
    /**
     * RunVariableRateJob refreshes the random pomeraj for every active
     * variable-rate loan and recomputes its installment amount. Admin-only.
     * @returns v1RunVariableRateJobResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceRunVariableRateJob({
        body,
    }: {
        body: v1RunVariableRateJobRequest,
    }): CancelablePromise<v1RunVariableRateJobResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/loans/run-variable-rate-job',
            body: body,
        });
    }
    /**
     * @returns v1LoanWithInstallments A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceGetLoan({
        id,
    }: {
        id: string,
    }): CancelablePromise<v1LoanWithInstallments | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/loans/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * QuoteExchange returns the converted-amount preview for a
     * menjačnica or FX payment, including commission. The FE uses this
     * to render the transfer-confirmation screen before the user clicks
     * Potvrdi.
     * @returns v1QuoteExchangeResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceQuoteExchange({
        body,
    }: {
        body: v1QuoteExchangeRequest,
    }): CancelablePromise<v1QuoteExchangeResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/menjacnica/quote',
            body: body,
        });
    }
    /**
     * @returns v1ListPaymentRecipientsResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceListPaymentRecipients(): CancelablePromise<v1ListPaymentRecipientsResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/payment-recipients',
        });
    }
    /**
     * @returns v1PaymentRecipient A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceCreatePaymentRecipient({
        body,
    }: {
        body: v1CreatePaymentRecipientRequest,
    }): CancelablePromise<v1PaymentRecipient | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/payment-recipients',
            body: body,
        });
    }
    /**
     * @returns any A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceDeletePaymentRecipient({
        id,
    }: {
        id: string,
    }): CancelablePromise<any | rpcStatus> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/payment-recipients/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns v1PaymentRecipient A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceUpdatePaymentRecipient({
        id,
        body,
    }: {
        id: string,
        body: BankServiceUpdatePaymentRecipientBody,
    }): CancelablePromise<v1PaymentRecipient | rpcStatus> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/payment-recipients/{id}',
            path: {
                'id': id,
            },
            body: body,
        });
    }
    /**
     * @returns v1PaymentResult A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceCreatePayment({
        body,
    }: {
        body: v1CreatePaymentRequest,
    }): CancelablePromise<v1PaymentResult | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/payments',
            body: body,
        });
    }
    /**
     * @returns v1ListTransactionsResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceListTransactions({
        accountId,
        opKind,
        status,
        page,
        pageSize,
    }: {
        /**
         * account_id filters to legs that touch this account on either side.
         * Empty + employee → see-everything; empty + client → all of caller's
         * accounts.
         */
        accountId?: string,
        /**
         * 'payment' | 'transfer' | 'exchange' | 'fee' — keep loose, server enforces.
         */
        opKind?: string,
        status?: string,
        page?: number,
        pageSize?: number,
    }): CancelablePromise<v1ListTransactionsResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/transactions',
            query: {
                'accountId': accountId,
                'opKind': opKind,
                'status': status,
                'page': page,
                'pageSize': pageSize,
            },
        });
    }
    /**
     * @returns v1PaymentResult A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static bankServiceCreateTransfer({
        body,
    }: {
        body: v1CreateTransferRequest,
    }): CancelablePromise<v1PaymentResult | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/transfers',
            body: body,
        });
    }
}
