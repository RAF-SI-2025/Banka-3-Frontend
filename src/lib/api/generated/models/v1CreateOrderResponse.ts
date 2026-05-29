/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { v1Order } from './v1Order';
/**
 * CreateOrderResponse wraps the created Order plus advisory flags. Spec
 * p.57 — *"Obavestiti korisnika ako je berza zatvorena"*: the order
 * still gets placed, but the FE renders a notice when the security's
 * exchange is currently closed (not open and not in the after-hours
 * window). For exchanges without a calendar (forex, options) the flag
 * is always false.
 */
export type v1CreateOrderResponse = {
    order?: v1Order;
    exchangeClosed?: boolean;
};

