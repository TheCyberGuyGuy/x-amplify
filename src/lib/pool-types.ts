// Pool handle categories.
export const POOL_TYPES = {
  ETORIAN: { label: "eTorian", short: "eTorian" },
  POPULAR_INVESTOR: { label: "Popular Investor", short: "PI" },
  ETORO_HANDLE: { label: "eToro Handle", short: "eToro" },
} as const;

export type PoolType = keyof typeof POOL_TYPES;

export const ALL_POOL_TYPES = Object.keys(POOL_TYPES) as PoolType[];

// Types a user can self-select during onboarding (eToro Handle is admin-only).
export const SELF_SELECTABLE_TYPES: PoolType[] = ["ETORIAN", "POPULAR_INVESTOR"];

export function isPoolType(v: unknown): v is PoolType {
  return typeof v === "string" && v in POOL_TYPES;
}

export function poolTypeLabel(v: string | null | undefined): string {
  return v && isPoolType(v) ? POOL_TYPES[v].label : "Unassigned";
}
