/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type TradingServiceCancelOrderBody = {
    /**
     * Optional partial-cancel quantity (spec p.57 "otkazivanje celog ili
     * dela Order-a"). When 0 or >= remaining_quantity, the whole order
     * is cancelled. When 0 < quantity < remaining_quantity, the order's
     * target quantity + remaining_quantity drop by this much; already-
     * executed fills are honoured per spec ("sve ono što je već
     * izvršeno i naplaćeno mora poštovati").
     */
    quantity?: number;
};

