/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type v1LoginRequest = {
    email?: string;
    password?: string;
    /**
     * long_lived_session is set by the mobile app (spec p.84 — no
     * session interval). When true the user service mints a long-lived
     * refresh token and the gateway returns it in the response body
     * instead of relying on the (RN-incompatible) httpOnly cookie. Web
     * clients leave it false and the cookie flow is unchanged.
     */
    longLivedSession?: boolean;
};

