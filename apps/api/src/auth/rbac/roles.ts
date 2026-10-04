/** Application roles (highest → lowest privilege) */
export const ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'MODERATOR',
  'SUPPORT',
  'USER',
] as const;

export type Role = (typeof ROLES)[number];

/** Fine-grained permissions */
export const PERMISSIONS = [
  'dashboard:read',
  'users:read',
  'users:create',
  'users:update',
  'users:delete',
  'users:hard_delete',
  'users:credit',
  'users:set_role',
  'audit:read',
  'system:read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL = [...PERMISSIONS] as Permission[];

/** Role → permissions map */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: ALL,
  ADMIN: [
    'dashboard:read',
    'users:read',
    'users:create',
    'users:update',
    'users:delete',
    'users:credit',
    'users:set_role',
    'audit:read',
    'system:read',
  ],
  MODERATOR: [
    'dashboard:read',
    'users:read',
    'users:update',
    'users:delete',
    'audit:read',
  ],
  SUPPORT: ['dashboard:read', 'users:read', 'audit:read', 'system:read'],
  USER: [],
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Normalize stored adminRoles + isAdmin flag into Role[] */
export function resolveRoles(user: {
  isAdmin?: boolean;
  adminRoles?: string[] | null;
}): Role[] {
  const raw = (user.adminRoles || []).filter(isRole) as Role[];
  if (raw.length) return Array.from(new Set(raw));
  if (user.isAdmin) return ['ADMIN'];
  return ['USER'];
}

export function permissionsForRoles(roles: Role[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const r of roles) {
    for (const p of ROLE_PERMISSIONS[r] || []) set.add(p);
  }
  return set;
}

export function hasPermission(roles: Role[], permission: Permission): boolean {
  return permissionsForRoles(roles).has(permission);
}

export function hasAnyRole(roles: Role[], required: Role[]): boolean {
  if (!required.length) return true;
  return required.some((r) => roles.includes(r));
}
