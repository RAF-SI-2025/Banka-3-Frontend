/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaBankV1Currency } from './bankaBankV1Currency';
import type { v1ScheduledPaymentStatus } from './v1ScheduledPaymentStatus';
export type v1ScheduledPayment = {
    id?: string;
    clientId?: string;
    fromAccountId?: string;
    toAccountNumber?: string;
    amount?: string;
    currency?: bankaBankV1Currency;
    recipientName?: string;
    paymentCode?: string;
    purpose?: string;
    model?: string;
    referenceNumber?: string;
    scheduledDate?: string;
    status?: v1ScheduledPaymentStatus;
    failureReason?: string;
    createdAt?: string;
    executedAt?: string;
};
