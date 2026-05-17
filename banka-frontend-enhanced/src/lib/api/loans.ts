import { api } from './client'
import type { v1Loan } from './generated/models/v1Loan'
import type { v1LoanRequest } from './generated/models/v1LoanRequest'
import type { v1LoanWithInstallments } from './generated/models/v1LoanWithInstallments'
import type { v1ListLoansResponse } from './generated/models/v1ListLoansResponse'
import type { v1ListLoanRequestsResponse } from './generated/models/v1ListLoanRequestsResponse'
import type { v1SubmitLoanRequestRequest } from './generated/models/v1SubmitLoanRequestRequest'
import type { BankServiceDecideLoanRequestBody } from './generated/models/BankServiceDecideLoanRequestBody'
import type { v1LoanType } from './generated/models/v1LoanType'
import type { v1LoanRequestStatus } from './generated/models/v1LoanRequestStatus'
import type { v1LoanStatus } from './generated/models/v1LoanStatus'

export type Loan = v1Loan
export type LoanRequest = v1LoanRequest
export type LoanWithInstallments = v1LoanWithInstallments

export interface ListLoansArgs {
  clientId?: string
  accountId?: string
  loanType?: v1LoanType
  status?: v1LoanStatus
  page?: number
  pageSize?: number
}

export interface ListLoanRequestsArgs {
  status?: v1LoanRequestStatus
  loanType?: v1LoanType
  accountId?: string
  page?: number
  pageSize?: number
}

export async function listLoans(args: ListLoansArgs = {}): Promise<v1ListLoansResponse> {
  const { data } = await api.get<v1ListLoansResponse>('/v1/loans', { params: args })
  return data
}

export async function getLoan(id: string): Promise<LoanWithInstallments> {
  const { data } = await api.get<LoanWithInstallments>(`/v1/loans/${id}`)
  return data
}

export async function listLoanRequests(args: ListLoanRequestsArgs = {}): Promise<v1ListLoanRequestsResponse> {
  const { data } = await api.get<v1ListLoanRequestsResponse>('/v1/loan-requests', { params: args })
  return data
}

export async function submitLoanRequest(input: v1SubmitLoanRequestRequest): Promise<LoanRequest> {
  const { data } = await api.post<LoanRequest>('/v1/loan-requests', input)
  return data
}

export async function decideLoanRequest(
  id: string,
  body: BankServiceDecideLoanRequestBody,
): Promise<LoanRequest> {
  const { data } = await api.post<LoanRequest>(`/v1/loan-requests/${id}/decide`, body)
  return data
}
