/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { v1ActuaryType } from './v1ActuaryType';
/**
 * ActuaryPerformance is one row on the supervisor-facing actuary
 * leaderboard. profit_rsd is the sum of *positive* gain_rsd on
 * realized_gains rows attributed to this actuary; losses are clamped
 * to zero per row, matching the capital-gains tax cron's reading.
 */
export type v1ActuaryPerformance = {
    userId?: string;
    displayName?: string;
    type?: v1ActuaryType;
    /**
     * profit_rsd is decimal-string RSD. Always positive (negative
     * contributions are clamped to zero per row before summing).
     */
    profitRsd?: string;
    /**
     * realized_count is the row count behind profit_rsd — useful for
     * sanity checks in the FE and the soak suite invariants.
     */
    realizedCount?: string;
};

