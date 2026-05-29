/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { bankaTradingV1Currency } from './bankaTradingV1Currency';
export type v1Exchange = {
    mic?: string;
    name?: string;
    acronym?: string;
    polity?: string;
    currency?: bankaTradingV1Currency;
    timezone?: string;
    openLocal?: string;
    closeLocal?: string;
    /**
     * is_open is the resolved state at the time of read: applies the
     * override if set, otherwise computes from local hours + timezone.
     */
    isOpen?: boolean;
    /**
     * is_after_hours is true within 4h of close per spec p.56.
     */
    isAfterHours?: boolean;
    /**
     * override_state carries the admin toggle. Empty string means "no
     * override, follow schedule"; otherwise one of "open" / "closed" /
     * "after_hours". The "after_hours" mode forces is_open=false and
     * is_after_hours=true at any wall-clock so admins can drive the
     * spec p.56 cadence path during testing.
     */
    overrideState?: string;
    updatedAt?: string;
};

