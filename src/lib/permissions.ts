// Mirrors pkg/permissions on the backend. Keep in sync — when a celina
// adds a permission, add it here too.

export const Permissions = {
  Admin: 'admin',
  EmployeeRead: 'employee.read',
  EmployeeWrite: 'employee.write',
  ClientRead: 'client.read',
  ClientWrite: 'client.write',
  PermissionGrant: 'permission.grant',
  CompanyRead: 'company.read',
  CompanyWrite: 'company.write',
  AccountRead: 'account.read',
  AccountWrite: 'account.write',
  ExchangeWrite: 'exchange.write',
  PaymentWrite: 'payment.write',
  CardRead: 'card.read',
  CardWrite: 'card.write',
  LoanRead: 'loan.read',
  LoanWrite: 'loan.write',
} as const

export type Permission = (typeof Permissions)[keyof typeof Permissions]

export function has(holder: string[], target: Permission): boolean {
  return holder.includes(target) || holder.includes(Permissions.Admin)
}

export function hasAny(holder: string[], targets: Permission[]): boolean {
  return targets.some((t) => has(holder, t))
}

export const permissionLabels: Record<Permission, string> = {
  [Permissions.Admin]: 'Administrator (puna kontrola)',
  [Permissions.EmployeeRead]: 'Pregled zaposlenih',
  [Permissions.EmployeeWrite]: 'Upravljanje zaposlenima',
  [Permissions.ClientRead]: 'Pregled klijenata',
  [Permissions.ClientWrite]: 'Upravljanje klijentima',
  [Permissions.PermissionGrant]: 'Dodela permisija',
  [Permissions.CompanyRead]: 'Pregled firmi',
  [Permissions.CompanyWrite]: 'Upravljanje firmama',
  [Permissions.AccountRead]: 'Pregled računa',
  [Permissions.AccountWrite]: 'Upravljanje računima',
  [Permissions.ExchangeWrite]: 'Upravljanje kursnom listom',
  [Permissions.PaymentWrite]: 'Plaćanja i transferi',
  [Permissions.CardRead]: 'Pregled kartica',
  [Permissions.CardWrite]: 'Upravljanje karticama',
  [Permissions.LoanRead]: 'Pregled kredita',
  [Permissions.LoanWrite]: 'Odobravanje kredita',
}
