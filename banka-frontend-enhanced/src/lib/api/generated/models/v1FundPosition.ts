/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type v1FundPosition = {
    id?: string;
    fundId?: string;
    fundName?: string;
    clientId?: string;
    units?: string;
    totalInvestedRsd?: string;
    currentValueRsd?: string;
    /**
     * profit_rsd = current_value_rsd − total_invested_rsd. Negative when
     * the fund has lost value since the client invested.
     */
    profitRsd?: string;
    sharePct?: string;
    createdAt?: string;
    updatedAt?: string;
};

