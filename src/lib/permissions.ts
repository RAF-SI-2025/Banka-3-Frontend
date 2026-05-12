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
  // Marker carried by employees who trade on behalf of the bank
  // (zeroes out the FX commission on menjačnica + trade legs).
  // Added in c2 backend so the bank-side branch could short-circuit;
  // the FE only needs it for label rendering on the perm picker.
  Actuary: 'actuary',
  ActuarySupervisor: 'actuary.supervisor',
  ActuaryAgent: 'actuary.agent',
  TradingClient: 'trading.client',
  TradingMargin: 'trading.margin',
  OTCRead: 'otc.read',
  OTCTradeClient: 'otc.trade.client',
  OTCTradeSupervisor: 'otc.trade.supervisor',
  FundsReadClient: 'funds.read.client',
  FundsInvestClient: 'funds.invest.client',
  FundsReadSupervisor: 'funds.read.supervisor',
  FundsManageSupervisor: 'funds.manage.supervisor',
  BankProfitRead: 'bank.profit.read',
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
  [Permissions.Actuary]: 'Aktuar (trguje za banku)',
  [Permissions.ActuarySupervisor]: 'Aktuar — supervizor',
  [Permissions.ActuaryAgent]: 'Aktuar — agent',
  [Permissions.TradingClient]: 'Klijent — trgovina',
  [Permissions.TradingMargin]: 'Trgovina margin nalozima',
  [Permissions.OTCRead]: 'OTC — pregled',
  [Permissions.OTCTradeClient]: 'OTC — trgovina (klijent)',
  [Permissions.OTCTradeSupervisor]: 'OTC — trgovina (supervizor)',
  [Permissions.FundsReadClient]: 'Fondovi — pregled (klijent)',
  [Permissions.FundsInvestClient]: 'Fondovi — ulaganje (klijent)',
  [Permissions.FundsReadSupervisor]: 'Fondovi — pregled (supervizor)',
  [Permissions.FundsManageSupervisor]: 'Fondovi — upravljanje',
  [Permissions.BankProfitRead]: 'Profit banke — pregled',
}
