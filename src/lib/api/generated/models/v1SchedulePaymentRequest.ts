/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type v1SchedulePaymentRequest = {
    fromAccountId?: string;
    toAccountNumber?: string;
    amount?: string;
    recipientName?: string;
    paymentCode?: string;
    referenceNumber?: string;
    model?: string;
    purpose?: string;
    /**
     * Future date the payment should execute on. Server rejects a
     * non-future value (spec: "Sistem proverava da li je datum u
     * budućnosti").
     */
    scheduledDate?: string;
};
