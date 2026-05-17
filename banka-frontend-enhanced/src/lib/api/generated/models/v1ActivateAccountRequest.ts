/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type v1ActivateAccountRequest = {
    /**
     * The activation token is a 32-byte URL-safe random string (43 chars
     * base64url, no padding). Be lenient on length but reject obvious
     * garbage so it can't reach the user service unparsed.
     */
    token?: string;
    /**
     * Password complexity is enforced server-side in pkg/passwords; the
     * proto-level rule is just the spec p.10 length window.
     */
    newPassword?: string;
};

