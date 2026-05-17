/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type v1CreatePaymentRequest = {
    fromAccountId?: string;
    /**
     * The recipient account is the spec's 18-digit "Račun primaoca". The
     * mod-11 checksum is verified server-side; here we only enforce the
     * shape so obviously-invalid input is rejected at the gateway.
     */
    toAccountNumber?: string;
    /**
     * Positive decimal in from-account currency, up to 4 fraction digits
     * (matching the numeric(20,4) storage).
     */
    amount?: string;
    recipientName?: string;
    /**
     * Spec p.21: 3 digits, first one "1" (gotovinska) or "2" (bezgotovinska);
     * online plaćanja uses 2xx. Default 289 is filled in server-side if empty.
     */
    paymentCode?: string;
    referenceNumber?: string;
    purpose?: string;
    saveRecipient?: boolean;
};

