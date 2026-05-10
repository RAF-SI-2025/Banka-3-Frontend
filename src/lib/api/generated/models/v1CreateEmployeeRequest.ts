/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaUserV1Gender } from './bankaUserV1Gender';
export type v1CreateEmployeeRequest = {
    email?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    /**
     * YYYY-MM-DD per spec p.8.
     */
    dateOfBirth?: string;
    gender?: bankaUserV1Gender;
    phone?: string;
    address?: string;
    position?: string;
    department?: string;
    /**
     * Optional so the server can distinguish "absent" (→ default true per
     * spec p.10: "Po default-u se podrazumeva da je korisnik aktivan")
     * from an explicit false. Generated as `*bool` in Go.
     */
    active?: boolean;
    /**
     * Initial role bundle, applied as a permission set; later admin
     * actions can amend via SetEmployeePermissions.
     */
    role?: string;
};

