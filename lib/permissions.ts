export type Visibility = "private" | "group" | "groups" | "public";

export function normalizeVisibility(v?: string | null): Visibility {
  if (v === "public") return "public";
  if (v === "group" || v === "groups") return "groups";
  return "private";
}

/**
 * Rules:
 * - private: owner only
 * - public: owner only (creator)
 * - groups/group: member of group (legacy group_id) OR member of any share group
 */
export function canEditContent(opts: {
  visibility?: string | null;
  ownerId?: string | null;
  userId?: string | null;
  isMemberOfLegacyGroup?: boolean;
  isMemberOfAnyShareGroup?: boolean;
}) {
  const vis = normalizeVisibility(opts.visibility);
  const isOwner = !!opts.userId && !!opts.ownerId && opts.userId === opts.ownerId;

  if (vis === "private") return isOwner;
  if (vis === "public") return isOwner;

  // groups / group
  return isOwner || !!opts.isMemberOfLegacyGroup || !!opts.isMemberOfAnyShareGroup;
}