/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * AccountSubtype only applies to Lični Tekući RSD per spec p.12; the
 * other kinds leave it UNSPECIFIED. New subtypes append.
 *
 * - ACCOUNT_SUBTYPE_SAVINGS: štedni
 * - ACCOUNT_SUBTYPE_PENSIONER: penzionerski
 * - ACCOUNT_SUBTYPE_YOUTH: za mlade
 * - ACCOUNT_SUBTYPE_STUDENT: za studente
 * - ACCOUNT_SUBTYPE_UNEMPLOYED: za nezaposlene
 * - ACCOUNT_SUBTYPE_DOO: Business subtypes (apply to Poslovni Tekući RSD).
 * - ACCOUNT_SUBTYPE_FOUNDATION: fondacija
 */
export enum v1AccountSubtype {
    ACCOUNT_SUBTYPE_UNSPECIFIED = 'ACCOUNT_SUBTYPE_UNSPECIFIED',
    ACCOUNT_SUBTYPE_STANDARD = 'ACCOUNT_SUBTYPE_STANDARD',
    ACCOUNT_SUBTYPE_SAVINGS = 'ACCOUNT_SUBTYPE_SAVINGS',
    ACCOUNT_SUBTYPE_PENSIONER = 'ACCOUNT_SUBTYPE_PENSIONER',
    ACCOUNT_SUBTYPE_YOUTH = 'ACCOUNT_SUBTYPE_YOUTH',
    ACCOUNT_SUBTYPE_STUDENT = 'ACCOUNT_SUBTYPE_STUDENT',
    ACCOUNT_SUBTYPE_UNEMPLOYED = 'ACCOUNT_SUBTYPE_UNEMPLOYED',
    ACCOUNT_SUBTYPE_DOO = 'ACCOUNT_SUBTYPE_DOO',
    ACCOUNT_SUBTYPE_AD = 'ACCOUNT_SUBTYPE_AD',
    ACCOUNT_SUBTYPE_FOUNDATION = 'ACCOUNT_SUBTYPE_FOUNDATION',
}
