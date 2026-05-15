/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type v1RefreshRequest = {
    refreshToken?: string;
    /**
     * Mobile passes its refresh token in the body (no cookie jar) and
     * keeps long_lived_session=true so the rotated token stays long-
     * lived. Web omits both — the gateway reads the cookie instead.
     */
    longLivedSession?: boolean;
};

