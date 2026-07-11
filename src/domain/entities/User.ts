export type UserRole = "admin" | "engineer" | "viewer";

export interface User {
  username: string;
  role: UserRole;
  token: string;
}

export interface Permission {
  action: string;
  resource: string;
}

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    "project:create",
    "project:read",
    "project:update",
    "project:delete",
    "plugin:toggle",
    "solver:run",
    "admin:panel"
  ],
  engineer: [
    "project:create",
    "project:read",
    "project:update",
    "solver:run"
  ],
  viewer: [
    "project:read"
  ]
};

export function hasPermission(role: UserRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
}
