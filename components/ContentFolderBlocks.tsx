import { ContentItemCard } from "@/components/ContentItemCard";
import { groupByFolderName, type FolderJoin } from "@/lib/content/grouping";
import { normalizeVisibility, type Visibility } from "@/lib/content/visibility";

type BaseItem = FolderJoin & {
  id: string;
  title: string;
  visibility: string | null;
};

function labelForVisibility(v: Visibility) {
  switch (v) {
    case "private":
      return "PRIVATE";
    case "public":
      return "PUBLIC";
    case "group":
      return "GROUP";
    case "groups":
      return "GROUPS";
  }
}

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  const label = labelForVisibility(visibility);
  const cls =
    visibility === "private" ? "badge-private" : visibility === "public" ? "badge-public" : "badge-shared";

  return <span className={`badge ${cls}`}>{label}</span>;
}

export function SectionHeader({
  title,
  subtitle,
  count,
  tone
}: {
  title: string;
  subtitle: string;
  count: number;
  tone: "private" | "shared" | "public";
}) {
  const border =
    tone === "private"
      ? "border-white/10"
      : tone === "shared"
      ? "border-blue-400/25"
      : "border-emerald-400/25";

  const bg =
    tone === "private"
      ? "bg-white/0"
      : tone === "shared"
      ? "bg-blue-400/5"
      : "bg-emerald-400/5";

  return (
    <div className={`card-soft ${border} ${bg} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 text-xs opacity-70">{subtitle}</div>
        </div>
        <div className="text-xs opacity-70">{count}</div>
      </div>
    </div>
  );
}

export function FolderBlocks<T extends BaseItem>({
  locale,
  items,
  rootLabel,
  basePath
}: {
  locale: string;
  items: T[];
  rootLabel: string;
  basePath: string; // e.g. "/flashcards" | "/qcm" | "/library"
}) {
  // folderNames are user-facing labels; folderIds are stable keys
  const { grouped, folderNames, folderIds } = groupByFolderName<T>(locale, items, rootLabel);

  // Items with no folder should not be presented as if they live inside a "(root)" folder.
  // We render them as a simple flat grid first, then the real folders below.
  const rootGroup = grouped.get("root")?.items ?? [];
  const folderOnlyIds = folderIds.filter((id) => id !== "root");
  const labelById = new Map(folderIds.map((id, i) => [id, folderNames[i] ?? rootLabel] as const));

  return (
    <div className="grid gap-3">
      {rootGroup.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {rootGroup.map((it) => (
            <ContentItemCard
              key={it.id}
              itemId={it.id}
              href={`${basePath}/${it.id}`}
              title={it.title}
              visibility={it.visibility}
              folderLabel={rootLabel}
              rootLabel={rootLabel}
            />
          ))}
        </div>
      ) : null}

      {folderOnlyIds.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {folderOnlyIds.map((folderId) => {
            const group = grouped.get(folderId);
            const folderTitle = labelById.get(folderId) ?? rootLabel;
            const folderItems = group?.items ?? [];

            return (
              <details key={folderId} className="group card-soft h-full">
                <summary className="cursor-pointer list-none select-none rounded-xl px-4 py-3 transition hover:bg-white/[0.06]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 opacity-70">📁</span>
                        <div className="truncate text-sm font-semibold">{folderTitle}</div>
                      </div>
                      <div className="text-xs opacity-70">{folderItems.length}</div>
                    </div>
                    <div className="text-sm opacity-60 transition group-open:rotate-180">▼</div>
                  </div>
                </summary>

                <div className="border-t border-white/10 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {folderItems.map((it) => (
                      <ContentItemCard
                        key={it.id}
                        itemId={it.id}
                        href={`${basePath}/${it.id}`}
                        title={it.title}
                        visibility={it.visibility}
                        folderLabel={folderTitle}
                        rootLabel={rootLabel}
                      />
                    ))}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
