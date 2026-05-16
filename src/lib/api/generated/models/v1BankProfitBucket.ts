/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * BankProfitBucket is one calendar period. profit_rsd uses the same
 * per-row loss clamp as the actuary leaderboard (Σ greatest(gain_rsd,
 * 0) on realized_gains where user_kind='employee'), so Σ profit_rsd
 * across every bucket of the full history reconciles with
 * Σ ListActuaryPerformances.profit_rsd. trading_rsd + fund_rsd
 * partition profit_rsd by source (realized_gains.security_id set vs
 * fund_id set). cumulative_rsd is the running total from the first
 * bucket in the response.
 */
export type v1BankProfitBucket = {
    periodStart?: string;
    profitRsd?: string;
    tradingRsd?: string;
    fundRsd?: string;
    cumulativeRsd?: string;
    realizedCount?: string;
};

