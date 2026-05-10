/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { rpcStatus } from '../models/rpcStatus';
import type { UserServiceSetEmployeeActiveBody } from '../models/UserServiceSetEmployeeActiveBody';
import type { UserServiceSetEmployeePermissionsBody } from '../models/UserServiceSetEmployeePermissionsBody';
import type { UserServiceUpdateClientBody } from '../models/UserServiceUpdateClientBody';
import type { UserServiceUpdateEmployeeBody } from '../models/UserServiceUpdateEmployeeBody';
import type { v1ActivateAccountRequest } from '../models/v1ActivateAccountRequest';
import type { v1Client } from '../models/v1Client';
import type { v1ConfirmPasswordResetRequest } from '../models/v1ConfirmPasswordResetRequest';
import type { v1CreateClientRequest } from '../models/v1CreateClientRequest';
import type { v1CreateEmployeeRequest } from '../models/v1CreateEmployeeRequest';
import type { v1Employee } from '../models/v1Employee';
import type { v1ListClientsResponse } from '../models/v1ListClientsResponse';
import type { v1ListEmployeesResponse } from '../models/v1ListEmployeesResponse';
import type { v1LoginRequest } from '../models/v1LoginRequest';
import type { v1LoginResponse } from '../models/v1LoginResponse';
import type { v1LogoutRequest } from '../models/v1LogoutRequest';
import type { v1MeResponse } from '../models/v1MeResponse';
import type { v1RefreshRequest } from '../models/v1RefreshRequest';
import type { v1RefreshResponse } from '../models/v1RefreshResponse';
import type { v1RequestPasswordResetRequest } from '../models/v1RequestPasswordResetRequest';
import type { v1ResendActivationRequest } from '../models/v1ResendActivationRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class UserServiceService {
    /**
     * @returns any A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static userServiceActivateAccount({
        body,
    }: {
        body: v1ActivateAccountRequest,
    }): CancelablePromise<any | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/auth/activate',
            body: body,
        });
    }
    /**
     * @returns any A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static userServiceResendActivation({
        body,
    }: {
        body: v1ResendActivationRequest,
    }): CancelablePromise<any | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/auth/activate/resend',
            body: body,
        });
    }
    /**
     * @returns v1LoginResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static userServiceLogin({
        body,
    }: {
        body: v1LoginRequest,
    }): CancelablePromise<v1LoginResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/auth/login',
            body: body,
        });
    }
    /**
     * @returns any A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static userServiceLogout({
        body,
    }: {
        body: v1LogoutRequest,
    }): CancelablePromise<any | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/auth/logout',
            body: body,
        });
    }
    /**
     * @returns v1MeResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static userServiceMe(): CancelablePromise<v1MeResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/auth/me',
        });
    }
    /**
     * @returns any A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static userServiceConfirmPasswordReset({
        body,
    }: {
        body: v1ConfirmPasswordResetRequest,
    }): CancelablePromise<any | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/auth/password-reset/confirm',
            body: body,
        });
    }
    /**
     * @returns any A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static userServiceRequestPasswordReset({
        body,
    }: {
        body: v1RequestPasswordResetRequest,
    }): CancelablePromise<any | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/auth/password-reset/request',
            body: body,
        });
    }
    /**
     * @returns v1RefreshResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static userServiceRefresh({
        body,
    }: {
        body: v1RefreshRequest,
    }): CancelablePromise<v1RefreshResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/auth/refresh',
            body: body,
        });
    }
    /**
     * @returns v1ListClientsResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static userServiceListClients({
        emailQuery,
        nameQuery,
        page,
        pageSize,
    }: {
        emailQuery?: string,
        nameQuery?: string,
        page?: number,
        pageSize?: number,
    }): CancelablePromise<v1ListClientsResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/clients',
            query: {
                'emailQuery': emailQuery,
                'nameQuery': nameQuery,
                'page': page,
                'pageSize': pageSize,
            },
        });
    }
    /**
     * CreateClient is the entry point used by the bank's account-creation
     * flow (spec p.9 footnote: "Zaposleni kreira Klijenta prilikom
     * kreiranja računa"). The activation email reuses the employee path:
     * the new client gets a link to set their initial password.
     * @returns v1Client A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static userServiceCreateClient({
        body,
    }: {
        body: v1CreateClientRequest,
    }): CancelablePromise<v1Client | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/clients',
            body: body,
        });
    }
    /**
     * @returns v1Client A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static userServiceGetClient({
        id,
    }: {
        id: string,
    }): CancelablePromise<v1Client | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/clients/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns v1Client A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static userServiceUpdateClient({
        id,
        body,
    }: {
        id: string,
        body: UserServiceUpdateClientBody,
    }): CancelablePromise<v1Client | rpcStatus> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/clients/{id}',
            path: {
                'id': id,
            },
            body: body,
        });
    }
    /**
     * @returns v1ListEmployeesResponse A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static userServiceListEmployees({
        emailQuery,
        nameQuery,
        positionQuery,
        page,
        pageSize,
    }: {
        emailQuery?: string,
        nameQuery?: string,
        positionQuery?: string,
        /**
         * 1-indexed; 0 → 1
         */
        page?: number,
        /**
         * default 50, max 200
         */
        pageSize?: number,
    }): CancelablePromise<v1ListEmployeesResponse | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/employees',
            query: {
                'emailQuery': emailQuery,
                'nameQuery': nameQuery,
                'positionQuery': positionQuery,
                'page': page,
                'pageSize': pageSize,
            },
        });
    }
    /**
     * @returns v1Employee A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static userServiceCreateEmployee({
        body,
    }: {
        body: v1CreateEmployeeRequest,
    }): CancelablePromise<v1Employee | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/employees',
            body: body,
        });
    }
    /**
     * @returns v1Employee A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static userServiceGetEmployee({
        id,
    }: {
        id: string,
    }): CancelablePromise<v1Employee | rpcStatus> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/employees/{id}',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns v1Employee A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static userServiceUpdateEmployee({
        id,
        body,
    }: {
        /**
         * Empty = no change for every field except id. We use IGNORE_IF_ZERO_VALUE
         * so the format checks fire only when the caller actually populates the
         * field.
         */
        id: string,
        body: UserServiceUpdateEmployeeBody,
    }): CancelablePromise<v1Employee | rpcStatus> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/employees/{id}',
            path: {
                'id': id,
            },
            body: body,
        });
    }
    /**
     * @returns v1Employee A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static userServiceSetEmployeeActive({
        id,
        body,
    }: {
        id: string,
        body: UserServiceSetEmployeeActiveBody,
    }): CancelablePromise<v1Employee | rpcStatus> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/employees/{id}/active',
            path: {
                'id': id,
            },
            body: body,
        });
    }
    /**
     * @returns v1Employee A successful response.
     * @returns rpcStatus An unexpected error response.
     * @throws ApiError
     */
    public static userServiceSetEmployeePermissions({
        id,
        body,
    }: {
        id: string,
        body: UserServiceSetEmployeePermissionsBody,
    }): CancelablePromise<v1Employee | rpcStatus> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/employees/{id}/permissions',
            path: {
                'id': id,
            },
            body: body,
        });
    }
}
