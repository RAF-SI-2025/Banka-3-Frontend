/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { v1Listing } from './v1Listing';
import type { v1Security } from './v1Security';
/**
 * SecurityWithListing collapses (security, listing) for the catalog
 * portal so the FE doesn't need to round-trip per row.
 */
export type v1SecurityWithListing = {
    security?: v1Security;
    listing?: v1Listing;
    /**
     * Computed; spec p.46 derived data.
     */
    maintenanceMargin?: string;
    initialMarginCost?: string;
};

