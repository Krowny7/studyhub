export type FolderJoin = {
  folder_id?: string | null;
  folder_path?: string | null;
  library_folders?: { id: string | null; name: string | null; parent_id: string | null } | null;
};

/**
 * Groups items by folder name, with a stable and locale-aware sort.
 * Items with no folder are grouped under `rootLabel`.
 */
export function groupByFolderName<T extends FolderJoin>(locale: string, items: T[], rootLabel: string) {
  // Group by folder id when possible, but keep a user-friendly label (path > name).
  const grouped = new Map<string, { label: string; items: T[] }>();

  for (const item of items) {
    const id = item.folder_id ?? item.library_folders?.id ?? "root";
    const label = (item.folder_path ?? item.library_folders?.name ?? null) || rootLabel;

    if (!grouped.has(id)) grouped.set(id, { label, items: [] });
    grouped.get(id)!.items.push(item);
  }

  const folderIds = Array.from(grouped.keys()).sort((a, b) => {
    if (a === "root") return -1;
    if (b === "root") return 1;
    return (grouped.get(a)!.label).localeCompare(grouped.get(b)!.label, locale);
  });

  return {
    grouped,
    folderNames: folderIds.map((id) => grouped.get(id)!.label),
    folderIds
  };
}
