import { api } from './client'

export type Gender = 'GENDER_MALE' | 'GENDER_FEMALE' | 'GENDER_OTHER' | 'GENDER_UNSPECIFIED'

export interface Employee {
  id: string
  email: string
  username: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: Gender
  phone: string
  address: string
  position: string
  department: string
  active: boolean
  activated: boolean
  permissions: string[]
}

export interface ListEmployeesArgs {
  emailQuery?: string
  nameQuery?: string
  positionQuery?: string
  page?: number
  pageSize?: number
}

export interface ListEmployeesResponse {
  employees: Employee[]
  page: number
  pageSize: number
  total: string // proto int64 marshalled as string
}

export async function listEmployees(args: ListEmployeesArgs): Promise<ListEmployeesResponse> {
  const { data } = await api.get<ListEmployeesResponse>('/v1/employees', { params: args })
  return data
}

export async function getEmployee(id: string): Promise<Employee> {
  const { data } = await api.get<Employee>(`/v1/employees/${id}`)
  return data
}

export interface CreateEmployeeInput {
  email: string
  username: string
  firstName: string
  lastName: string
  dateOfBirth: string // YYYY-MM-DD
  gender: Gender
  phone: string
  address: string
  position: string
  department: string
  active: boolean
  role: 'admin' | 'supervisor' | 'agent' | 'basic'
}

export async function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  const { data } = await api.post<Employee>('/v1/employees', input)
  return data
}

export interface UpdateEmployeeInput {
  email?: string
  username?: string
  firstName?: string
  lastName?: string
  dateOfBirth?: string
  gender?: Gender
  phone?: string
  address?: string
  position?: string
  department?: string
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<Employee> {
  const { data } = await api.patch<Employee>(`/v1/employees/${id}`, input)
  return data
}

export async function setEmployeeActive(id: string, active: boolean): Promise<Employee> {
  const { data } = await api.post<Employee>(`/v1/employees/${id}/active`, { active })
  return data
}

export async function setEmployeePermissions(id: string, permissions: string[]): Promise<Employee> {
  const { data } = await api.put<Employee>(`/v1/employees/${id}/permissions`, { permissions })
  return data
}
