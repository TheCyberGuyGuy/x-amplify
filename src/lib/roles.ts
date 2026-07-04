// User roles are separate from pool types: a person can be an eTorian/PI
// AND hold an ADMIN or SUPER_ADMIN role on top.
export type Role = "EMPLOYEE" | "ADMIN" | "SUPER_ADMIN";

const RANK: Record<string, number> = {
  EMPLOYEE: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export function isAdmin(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === "SUPER_ADMIN";
}

/** Returns whichever role is higher — env can elevate, never demote. */
export function highestRole(a: string, b: string): Role {
  return (RANK[a] ?? 1) >= (RANK[b] ?? 1) ? (a as Role) : (b as Role);
}
