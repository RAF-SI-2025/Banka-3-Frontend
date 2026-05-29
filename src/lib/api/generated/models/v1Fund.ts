/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { v1FundStatus } from './v1FundStatus';
/**
 * Fund is one investment-fund row. total_value_rsd + profit_rsd are
 * computed at read time (liquid_rsd + holdings_value_rsd; profit =
 * total_value − Σ total_invested_rsd across positions).
 */
export type v1Fund = {
    id?: string;
    name?: string;
    description?: string;
    managerUserId?: string;
    managerDisplayName?: string;
    bankAccountId?: string;
    bankAccountNumber?: string;
    minimumContribution?: string;
    totalUnits?: string;
    /**
     * Computed at read time. RSD.
     */
    liquidRsd?: string;
    holdingsValueRsd?: string;
    totalValueRsd?: string;
    /**
     * profit_rsd = total_value_rsd − Σ total_invested_rsd across all
     * positions. Negative when the fund is below contributed capital.
     */
    profitRsd?: string;
    unitPriceRsd?: string;
    status?: v1FundStatus;
    createdAt?: string;
    updatedAt?: string;
};

