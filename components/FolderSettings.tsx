"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";
import { FolderTreePicker } from "@/components/FolderTreePicker";
import type { FolderNode } from "@/components/FolderTreePicker";
import type { FolderRow } from "@/components/FolderDriveView";

function buildChildrenMap(folders: FolderNode[]) {
  const children = new Map<string | null, FolderNode[]>();
  for (const f of folders) {
    const k = f.parent_id ?? null;
    const arr = children.get(k) ?? [];
    arr.push(f);
    children.set(k, arr);
  }
  return children;
}

function descendantsOf(folders: FolderNode[], id: string): Set<string> {
  const children = buildChildrenMap(folders);
  const out = new Set<string>();
  const stack: string[] = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    const kids = children.get(cur) ?? [];
    for (const k of kids) {
      if (!out.has(k.id)) {
        out.add(k.id);
        stack.push(k.id);
      }
    }
  }
  return out;
}

export function FolderSettings({
  kind,
  itemTable,
  folder,
  folders,
  directChildCount,
  directItemCount,
  onUpdated,
  onDeleted
}: {
  kind: "documents" | "flashcards" | "quizzes" | "exercises";
  itemTable: "documents" | "flashcard_sets" | "quiz_sets" | "exercise_sets";
  folder: FolderRow;
  folders: FolderRow[];
  directChildCount: number;
  directItemCount: number;
  onUpdated?: () => void;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { t } = useI18n();

  const nodes: FolderNode[] = useMemo(
    () =>
      folders.map((f) => ({
        id: String(f.id),
        name: (f.name ?? "").trim() || t("folders.root"),
        parent_id: f.parent_id ? String(f.parent_id) : null
      })),
    [folders, t]
  );

  const [name, setName] = useState((folder.name ?? "").trim());
  const [parentId, setParentId] = useState<string | null>(folder.parent_id ? String(folder.parent_id) : null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setName((folder.name ?? "").trim());
    setParentId(folder.parent_id ? String(folder.parent_id) : null);
    setMsg(null);
  }, [folder.id]);

  const invalidParentIds = useMemo(() => {
    const d = descendantsOf(nodes, String(folder.id));
    d.add(String(folder.id));
    return d;
  }, [nodes, folder.id]);

  const parentPickerNodes = useMemo(() => nodes.filter((n) => !invalidParentIds.has(n.id)), [nodes, invalidParentIds]);

  const notEmptyByUi = directChildCount > 0 || directItemCount > 0;

  async function saveRename() {
    const next = name.trim();
    if (!next) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await supabase
        .from("library_folders")
        .update({ name: next })
        .eq("id", String(folder.id))
        .eq("kind", kind);
      if (res.error) throw res.error;
      setMsg(t("folders.updated"));
      router.refresh();
      onUpdated?.();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveMove() {
    if (invalidParentIds.has(parentId as any)) {
      setMsg(`❌ ${t("folders.invalidMove")}`);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await supabase
        .from("library_folders")
        .update({ parent_id: parentId ?? null })
        .eq("id", String(folder.id))
        .eq("kind", kind);
      if (res.error) throw res.error;
      setMsg(t("folders.updated"));
      router.refresh();
      onUpdated?.();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setBusy(false);
    }
  }

  async function safeDelete() {
    if (notEmptyByUi) {
      setMsg(`❌ ${t("folders.deleteNotEmpty")}`);
      return;
    }
    if (!confirm(t("folders.deleteConfirm"))) return;

    setBusy(true);
    setMsg(null);
    try {
      // Extra safety check (prevents deleting non-empty folders if UI is stale)
      const kids = await supabase
        .from("library_folders")
        .select("id")
        .eq("kind", kind)
        .eq("parent_id", String(folder.id))
        .limit(1);
      if (kids.error) throw kids.error;
      if ((kids.data ?? []).length) {
        setMsg(`❌ ${t("folders.deleteNotEmpty")}`);
        return;
      }

      const inFolder = await supabase
        .from(itemTable)
        .select("id")
        .eq("folder_id", String(folder.id))
        .limit(1);
      if (inFolder.error) throw inFolder.error;
      if ((inFolder.data ?? []).length) {
        setMsg(`❌ ${t("folders.deleteNotEmpty")}`);
        return;
      }

      const res = await supabase
        .from("library_folders")
        .delete()
        .eq("id", String(folder.id))
        .eq("kind", kind);
      if (res.error) throw res.error;
      setMsg(t("common.deleted"));
      router.refresh();
      onDeleted?.();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="text-sm opacity-70">{t("folders.folder")}</div>
      <div className="text-base font-semibold truncate" title={(folder.name ?? "").trim()}
      >
        {(folder.name ?? "").trim() || t("folders.root")}
      </div>

      <div className="grid gap-2">
        <div className="text-xs opacity-70">{t("folders.rename")}</div>
        <div className="flex gap-2">
          <input className="input flex-1" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-secondary" type="button" disabled={busy || !name.trim()} onClick={saveRename}>
            {t("common.save")}
          </button>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="text-xs opacity-70">{t("folders.move")}</div>
        <FolderTreePicker
          folders={parentPickerNodes}
          value={parentId}
          onChange={setParentId}
          label={t("folders.pickParent")}
          noneLabel={t("folders.none")}
          buttonClassName="btn btn-secondary w-full justify-between gap-3 text-left"
        />
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={saveMove}>
          {t("folders.applyMove")}
        </button>
      </div>

      <div className="grid gap-2">
        <div className="text-xs opacity-70">{t("common.delete")}</div>
        <button
          className="btn btn-ghost justify-start border border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
          type="button"
          disabled={busy}
          onClick={safeDelete}
          title={notEmptyByUi ? t("folders.deleteNotEmpty") : undefined}
        >
          {t("common.delete")}
          {notEmptyByUi ? <span className="ml-2 text-xs opacity-80">({t("folders.notEmpty")})</span> : null}
        </button>
        {notEmptyByUi ? <div className="text-xs opacity-60">{t("folders.deleteHint")}</div> : null}
      </div>

      {msg ? <div className="text-sm">{msg}</div> : null}
    </div>
  );
}
