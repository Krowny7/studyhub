export type Visibility = "private" | "group" | "groups" | "public";
export type ScopeFilter = "all" | "private" | "shared" | "public";

/**
 * UI scope filter:
 * - "shared" means any group-based visibility ("group" or "groups").
 */
export function normalizeScope(value: any): ScopeFilter {
  if (value === "private" || value === "public" || value === "all" || value === "shared") return value;
  // Backward/compat (old pages sometimes used "group")
  if (value === "group" || value === "groups") return "shared";
  return "all";
}

export function normalizeVisibility(value: any): Visibility {
  if (value === "private" || value === "group" || value === "groups" || value === "public") return value;
  return "private";
}

export function isSharedVisibility(v: Visibility): boolean {
  return v === "group" || v === "groups";
}

export type VisibilitySection = "private" | "shared" | "public";

export function sectionForVisibility(value: any): VisibilitySection {
  const v = normalizeVisibility(value);
  if (v === "private") return "private";
  if (v === "public") return "public";
  return "shared";
}

export function matchesScope(visibilityValue: any, scope: ScopeFilter): boolean {
  const v = normalizeVisibility(visibilityValue);
  if (scope === "all") return true;
  if (scope === "private") return v === "private";
  if (scope === "public") return v === "public";
  // shared
  return isSharedVisibility(v);
}
