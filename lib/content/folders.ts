export type LibraryFolderRow = {
  id: string;
  name: string | null;
  parent_id: string | null;
};

type SupabaseLike = {
  from: (table: string) => any;
};

/**
 * Fetch folders for the given ids, plus all ancestors (parent_id chain).
 * Safe for server components (uses the provided supabase client).
 */
export async function fetchFoldersWithAncestors(
  supabase: SupabaseLike,
  folderIds: string[]
): Promise<Map<string, LibraryFolderRow>> {
  const map = new Map<string, LibraryFolderRow>();
  const pending = new Set(folderIds.filter(Boolean));

  // Hard stop to avoid infinite loops in case of cycles.
  for (let i = 0; i < 8 && pending.size; i++) {
    const batch = Array.from(pending);
    pending.clear();

    const { data } = await supabase
      .from("library_folders")
      .select("id,name,parent_id")
      .in("id", batch);

    for (const f of (data ?? []) as any[]) {
      const row: LibraryFolderRow = {
        id: String(f.id),
        name: f.name ?? null,
        parent_id: f.parent_id ?? null
      };
      map.set(row.id, row);
      if (row.parent_id && !map.has(row.parent_id)) pending.add(row.parent_id);
    }
  }

  return map;
}

/** Build a display path like "Parent / Child" for each folder id. */
export function buildFolderPathMap(
  folders: Map<string, LibraryFolderRow>,
  rootLabel: string
): Map<string, string> {
  const memo = new Map<string, string>();

  const pathOf = (id: string): string => {
    if (memo.has(id)) return memo.get(id)!;
    const f = folders.get(id);
    if (!f) {
      memo.set(id, rootLabel);
      return rootLabel;
    }

    const name = (f.name ?? "").trim() || rootLabel;
    if (!f.parent_id) {
      memo.set(id, name);
      return name;
    }
    const parent = pathOf(f.parent_id);
    const out = parent ? `${parent} / ${name}` : name;
    memo.set(id, out);
    return out;
  };

  const out = new Map<string, string>();
  for (const id of folders.keys()) out.set(id, pathOf(id));
  return out;
}
