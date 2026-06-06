/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { v1OTCMatchSuggestion } from './v1OTCMatchSuggestion';
export type v1SuggestOTCMatchesResponse = {
    suggestions?: Array<v1OTCMatchSuggestion>;
    /**
     * tolerance_pct echoes the effective band used (5 when defaulted).
     */
    tolerancePct?: number;
};

