"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { ContentItemCard } from "@/components/ContentItemCard";
import { FolderActions } from "@/components/FolderActions";

export type FolderRow = {
  id: string;
  name: string | null;
  parent_id: string | null;
};

type DriveItem = {
  id: string;
  title: string;
  visibility: string | null;
  folder_id?: string | null;
};

function buildHref(basePath: string, current: Record<string, any>, nextFolderId: string | null) {
  const sp = new URLSearchParams();
  const next: Record<string, any> = { ...current };
  if (nextFolderId) next.folder = nextFolderId;
  else delete next.folder;

  for (const [k, v] of Object.entries(next)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.join(","));
    } else {
      const s = String(v);
      if (s.trim().length) sp.set(k, s);
    }
  }

  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function folderLabel(f: FolderRow | undefined | null, rootLabel: string) {
  const name = (f?.name ?? "").trim();
  return name.length ? name : rootLabel;
}

export function FolderDriveView<T extends DriveItem>({
  folders,
  items,
  currentFolderId,
  basePath,
  currentQuery,
  rootLabel,
  openLabel,
  emptyLabel,
  upLabel,
  folderKind,
  itemActions,
  enableLocalSearch = true,
  localSearchPlaceholder,
  enableNewFolder = true,
  newFolderLabel,
  newFolderPlaceholder,
  createFolderLabel,
  cancelLabel,
  savingLabel,
  subfoldersLabel,
  itemsLabel,
  emptyFolderLabel,
  homeLabel
}: {
  folders: FolderRow[];
  items: T[];
  currentFolderId: string | null;
  basePath: string;
  currentQuery: Record<string, any>;
  rootLabel: string;
  openLabel?: string;
  emptyLabel?: string;
  upLabel?: string;
  folderKind?: "documents" | "flashcards" | "quizzes" | "exercises";
  itemActions?: {
    table: "documents" | "flashcard_sets" | "quiz_sets" | "exercise_sets";
    shareTable: "document_shares" | "flashcard_set_shares" | "quiz_set_shares" | "exercise_set_shares";
    shareFk: "document_id" | "set_id";
    activeGroupId: string | null;
    subtitle?: string;
  };
  enableLocalSearch?: boolean;
  localSearchPlaceholder?: string;
  enableNewFolder?: boolean;
  newFolderLabel?: string;
  newFolderPlaceholder?: string;
  createFolderLabel?: string;
  cancelLabel?: string;
  savingLabel?: string;
  subfoldersLabel?: string;
  itemsLabel?: string;
  emptyFolderLabel?: string;
  /** Label shown in the breadcrumb when you're at the root (no folder selected). */
  homeLabel?: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [localQ, setLocalQ] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const folderMap = new Map<string, FolderRow>();
  for (const f of folders) folderMap.set(String(f.id), { ...f, id: String(f.id) });

  const normalizedCurrent = currentFolderId && folderMap.has(currentFolderId) ? currentFolderId : null;
  const currentFolder = normalizedCurrent ? folderMap.get(normalizedCurrent)! : null;

  // Breadcrumb path from root to current.
  const path: FolderRow[] = [];
  let cur: FolderRow | null = currentFolder;
  for (let i = 0; i < 12 && cur; i++) {
    path.unshift(cur);
    const pid = cur.parent_id ? String(cur.parent_id) : null;
    cur = pid && folderMap.has(pid) ? folderMap.get(pid)! : null;
  }

  const normalizedSearch = localQ.trim().toLowerCase();
  const matches = (s: string) => (normalizedSearch ? s.toLowerCase().includes(normalizedSearch) : true);

  const childFoldersAll = folders
    .filter((f) => (f.parent_id ?? null) === normalizedCurrent)
    .slice()
    .sort((a, b) => folderLabel(a, rootLabel).localeCompare(folderLabel(b, rootLabel)));

  const childFolders = enableLocalSearch
    ? childFoldersAll.filter((f) => matches(folderLabel(f, rootLabel)))
    : childFoldersAll;

  const itemsHereAll = items.filter((it) => (it.folder_id ?? null) === normalizedCurrent);
  const itemsHere = enableLocalSearch ? itemsHereAll.filter((it) => matches(it.title)) : itemsHereAll;

  // Counts per folder (direct items).
  const directCount = new Map<string, number>();
  for (const it of items) {
    const fid = it.folder_id ?? null;
    if (!fid) continue;
    const k = String(fid);
    directCount.set(k, (directCount.get(k) ?? 0) + 1);
  }

  // Counts per folder (direct subfolders).
  const childCount = new Map<string, number>();
  for (const f of folders) {
    const pid = f.parent_id ?? null;
    if (!pid) continue;
    const k = String(pid);
    childCount.set(k, (childCount.get(k) ?? 0) + 1);
  }

  const upId = currentFolder?.parent_id ? String(currentFolder.parent_id) : null;

  const breadcrumb = (() => {
    if (path.length <= 2) return { head: path, showEllipsis: false, tail: [] as FolderRow[] };
    if (path.length <= 4) return { head: path, showEllipsis: false, tail: [] as FolderRow[] };
    // Root link is separate; keep last 2 segments.
    return { head: [] as FolderRow[], showEllipsis: true, tail: path.slice(-2) };
  })();

  return (
    <div className="grid gap-3">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {normalizedCurrent ? (
          <Link href={buildHref(basePath, currentQuery, null)} className="rounded-lg px-2 py-1 hover:bg-white/[0.06]">
            {rootLabel}
          </Link>
        ) : homeLabel ? (
          <span className="rounded-lg px-2 py-1 opacity-70">{homeLabel}</span>
        ) : null}
        {breadcrumb.head.map((f) => (
          <div key={f.id} className="flex items-center gap-2">
            <span className="opacity-40">/</span>
            <Link
              href={buildHref(basePath, currentQuery, f.id)}
              className="max-w-[22ch] truncate rounded-lg px-2 py-1 hover:bg-white/[0.06]"
              title={folderLabel(f, rootLabel)}
            >
              {folderLabel(f, rootLabel)}
            </Link>
          </div>
        ))}

        {breadcrumb.showEllipsis ? (
          <div className="flex items-center gap-2">
            <span className="opacity-40">/</span>
            <span className="rounded-lg px-2 py-1 opacity-60" title={path.map((p) => folderLabel(p, rootLabel)).join(" / ")}
            >
              …
            </span>
          </div>
        ) : null}

        {breadcrumb.tail.map((f) => (
          <div key={f.id} className="flex items-center gap-2">
            <span className="opacity-40">/</span>
            <Link
              href={buildHref(basePath, currentQuery, f.id)}
              className="max-w-[22ch] truncate rounded-lg px-2 py-1 hover:bg-white/[0.06]"
              title={folderLabel(f, rootLabel)}
            >
              {folderLabel(f, rootLabel)}
            </Link>
          </div>
        ))}

        <div className="ml-auto flex items-center gap-2">
          {enableLocalSearch ? (
            <input
              value={localQ}
              onChange={(e) => setLocalQ(e.target.value)}
              placeholder={localSearchPlaceholder ?? "Search in folder…"}
              className="input h-9 w-[14rem] max-w-[60vw] text-sm"
            />
          ) : null}

          {normalizedCurrent ? (
            <Link href={buildHref(basePath, currentQuery, upId)} className="btn btn-ghost px-3 py-1.5 text-xs">
              {upLabel ?? "↑ Up"}
            </Link>
          ) : null}

          {enableNewFolder && folderKind ? (
            <button
              type="button"
              className="btn btn-secondary px-3 py-1.5 text-xs"
              onClick={() => {
                setErrorText(null);
                setFolderName("");
                setShowNewFolder((v) => !v);
              }}
            >
              {newFolderLabel ?? "+ Folder"}
            </button>
          ) : null}
        </div>
      </div>

      {showNewFolder && enableNewFolder && folderKind ? (
        <div className="card-soft p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input h-9 flex-1"
              placeholder={newFolderPlaceholder ?? "Folder name"}
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary h-9 px-3 text-sm"
              disabled={busy || !folderName.trim()}
              onClick={async () => {
                setBusy(true);
                setErrorText(null);
                try {
                  const { data: auth } = await supabase.auth.getUser();
                  const user = auth.user;
                  if (!user) {
                    setErrorText("Not authenticated.");
                    return;
                  }

                  await supabase
                    .from("library_folders")
                    .insert({
                      owner_id: user.id,
                      kind: folderKind,
                      name: folderName.trim(),
                      parent_id: normalizedCurrent
                    })
                    .throwOnError();

                  setFolderName("");
                  setShowNewFolder(false);
                  router.refresh();
                } catch (err: any) {
                  console.error("FolderDriveView.createFolder error:", err);
                  setErrorText(err?.message ?? "Failed to create folder.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? savingLabel ?? "Saving…" : createFolderLabel ?? "Create"}
            </button>
            <button
              type="button"
              className="btn btn-ghost h-9 px-3 text-sm"
              onClick={() => {
                setShowNewFolder(false);
                setFolderName("");
                setErrorText(null);
              }}
            >
              {cancelLabel ?? "Cancel"}
            </button>
          </div>
          {errorText ? (
            <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {errorText}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Subfolders */}
      {childFolders.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {childFolders.map((f) => {
            const name = folderLabel(f, rootLabel);
            const dCount = directCount.get(String(f.id)) ?? 0;
            const cCount = childCount.get(String(f.id)) ?? 0;
            const href = buildHref(basePath, currentQuery, String(f.id));
            return (
              <div
                key={f.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(href)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(href);
                  }
                }}
                className="card-soft group cursor-pointer p-4 transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="opacity-70">📁</span>
                        <div className="truncate text-sm font-semibold">{name}</div>
                      </div>
                      {/* Keep a subtle "open" affordance */}
                      <div className="text-sm opacity-50 transition group-hover:translate-x-0.5">→</div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {cCount ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs opacity-80">
                          {cCount} {subfoldersLabel ?? "subfolders"}
                        </span>
                      ) : null}
                      {dCount ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs opacity-80">
                          {dCount} {itemsLabel ?? "items"}
                        </span>
                      ) : null}
                      {!cCount && !dCount ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs opacity-70">
                          {emptyFolderLabel ?? "Empty"}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {folderKind ? (
                    <FolderActions
                      folder={f}
                      folders={folders}
                      kind={folderKind}
                      itemTable={
                        folderKind === "documents"
                          ? "documents"
                          : folderKind === "flashcards"
                            ? "flashcard_sets"
                            : folderKind === "quizzes"
                              ? "quiz_sets"
                              : "exercise_sets"
                      }
                      directChildCount={cCount}
                      directItemCount={dCount}
                      onChanged={() => router.refresh()}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Items in current folder */}
      {itemsHere.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {itemsHere.map((it) => (
            <ContentItemCard
              key={it.id}
              itemId={it.id}
              href={`${basePath}/${it.id}`}
              title={it.title}
              visibility={it.visibility}
              folderLabel={folderLabel(currentFolder, rootLabel)}
              rootLabel={rootLabel}
              actions={
                itemActions && folderKind
                  ? {
                      table: itemActions.table,
                      visibility: it.visibility,
                      folderId: (it.folder_id ?? null) as any,
                      folderKind: folderKind as any,
                      shareTable: itemActions.shareTable,
                      shareFk: itemActions.shareFk,
                      activeGroupId: itemActions.activeGroupId,
                      subtitle: itemActions.subtitle
                    }
                  : undefined
              }
            />
          ))}
        </div>
      ) : childFoldersAll.length ? (
        <div className="text-sm opacity-70">{emptyLabel ?? "No items in this folder."}</div>
      ) : (
        <div className="text-sm opacity-70">{emptyLabel ?? "Nothing here yet."}</div>
      )}
    </div>
  );
}
