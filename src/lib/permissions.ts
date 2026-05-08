// Mirrors pkg/permissions on the backend. Keep in sync — when a celina
// adds a permission, add it here too.

export const Permissions = {
  Admin: 'admin',
  EmployeeRead: 'employee.read',
  EmployeeWrite: 'employee.write',
  ClientRead: 'client.read',
  ClientWrite: 'client.write',
  PermissionGrant: 'permission.grant',
} as const

export type Permission = (typeof Permissions)[keyof typeof Permissions]

export function has(holder: string[], target: Permission): boolean {
  return holder.includes(target) || holder.includes(Permissions.Admin)
}

export function hasAny(holder: string[], targets: Permission[]): boolean {
  return targets.some((t) => has(holder, t))
}

// Serbian labels for the permission-management UI. Keys must match the
// values in `Permissions` so the lookup can't drift silently — the type
// of `permissionLabels` is `Record<Permission, string>`.
export const permissionLabels: Record<Permission, string> = {
  [Permissions.Admin]: 'Administrator (puna kontrola)',
  [Permissions.EmployeeRead]: 'Pregled zaposlenih',
  [Permissions.EmployeeWrite]: 'Upravljanje zaposlenima',
  [Permissions.ClientRead]: 'Pregled klijenata',
  [Permissions.ClientWrite]: 'Upravljanje klijentima',
  [Permissions.PermissionGrant]: 'Dodela permisija',
}
