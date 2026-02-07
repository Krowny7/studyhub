"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";
import { GroupMultiPicker } from "@/components/GroupMultiPicker";
import type { FolderKind } from "@/components/FolderPicker";

type ShareMode = "private" | "public" | "groups";

type Folder = { id: string; name: string; parent_id: string | null };

export function ContentItemSettings({
  title,
  subtitle,
  itemId,
  table,
  visibility,
  folderId,
  folderKind,
  shareTable,
  shareFk,
  rootLabel,
  activeGroupId,
  initialSharedGroupIds = [],
  legacyGroupId = null,
  compact = false,
  onDeleted,
  onUpdated
}: {
  title: string;
  subtitle: string;
  itemId: string;
  table: "documents" | "flashcard_sets" | "quiz_sets" | "exercise_sets";
  visibility: string | null;
  folderId: string | null;
  folderKind: FolderKind;
  shareTable: "document_shares" | "flashcard_set_shares" | "quiz_set_shares" | "exercise_set_shares";
  shareFk: "document_id" | "set_id";
  rootLabel: string;
  activeGroupId: string | null;
  initialSharedGroupIds?: string[];
  legacyGroupId?: string | null;

  // When used inside a modal, `compact` removes the accordion wrapper.
  compact?: boolean;

  onDeleted?: () => void;
  onUpdated?: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { t } = useI18n();

  const defaultRedirect = table === "documents" ? "/library" : table === "flashcard_sets" ? "/flashcards" : table === "quiz_sets" ? "/qcm" : "/exercises";

  const [draftTitle, setDraftTitle] = useState(title);
  const [shareMode, setShareMode] = useState<ShareMode>(
    visibility === "public" ? "public" : visibility === "group" || visibility === "groups" ? "groups" : "private"
  );
  const [groupIds, setGroupIds] = useState<string[]>(() => {
    const base = [...(initialSharedGroupIds ?? []), ...(legacyGroupId ? [legacyGroupId] : [])].filter(Boolean) as string[];
    return Array.from(new Set(base));
  });

  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(folderId);
  const [newFolderName, setNewFolderName] = useState("");

  const [loadingShares, setLoadingShares] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    setDraftTitle(title);
  }, [title]);

  useEffect(() => {
    setSelectedFolderId(folderId);
  }, [folderId]);

  useEffect(() => {
    // Load folders for this kind
    (async () => {
      try {
        const { data } = await supabase
          .from("library_folders")
          .select("id,name,parent_id")
          .eq("kind", folderKind)
          .order("name", { ascending: true });
        setFolders((data ?? []) as any);
      } catch {
        setFolders([]);
      }
    })();
  }, [supabase, folderKind]);

  useEffect(() => {
    // Load share targets if the item uses group sharing.
    if (shareMode !== "groups") return;
    (async () => {
      setLoadingShares(true);
      try {
        const { data, error } = await (supabase as any).from(shareTable).select("group_id").eq(shareFk, itemId);
        if (error) throw error;
        const ids = (data ?? []).map((r: any) => r.group_id).filter(Boolean);
        setGroupIds((prev) => Array.from(new Set([...prev, ...ids])));
      } catch {
        // Keep the current selection (legacy/initial IDs) if reading shares fails.
      } finally {
        setLoadingShares(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareMode, itemId, shareTable]);

  async function createFolder() {
    setErrorText(null);
    setMsg(null);

    const name = newFolderName.trim();
    if (!name) return;

    setCreatingFolder(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("library_folders")
        .insert({ owner_id: auth.user.id, kind: folderKind, name, parent_id: null })
        .select("id,name,parent_id")
        .maybeSingle();

      if (error) throw error;

      setNewFolderName("");
      // refresh list locally (avoid extra query)
      if (data?.id) {
        setFolders((prev) => [...prev, data as any].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedFolderId(data.id);
      }
    } catch (e: any) {
      setErrorText(e?.message ?? t("common.error"));
    } finally {
      setCreatingFolder(false);
    }
  }

  async function saveAll() {
    setErrorText(null);
    setMsg(null);

    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");

      const normalizedVisibility = shareMode === "groups" ? "groups" : shareMode;

      // 1) Update main row
      const { error: upErr } = await (supabase as any)
        .from(table)
        .update({ title: draftTitle.trim(), visibility: normalizedVisibility, folder_id: selectedFolderId })
        .eq("id", itemId);
      if (upErr) throw upErr;

      // 2) Update shares
      await (supabase as any).from(shareTable).delete().eq(shareFk as any, itemId);
      if (shareMode === "groups" && groupIds.length) {
        const rows = groupIds.map((gid) => ({ [shareFk]: itemId, group_id: gid }));
        const { error } = await (supabase as any).from(shareTable).insert(rows as any);
        if (error) throw error;
      }

      setMsg(t("common.saved"));
      onUpdated?.();
      // Keep server components in sync
      router.refresh();
    } catch (e: any) {
      setErrorText(e?.message ?? t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem() {
    setErrorText(null);
    setMsg(null);

    if (!confirm(t("common.confirmDelete"))) return;

    setSaving(true);
    try {
      await (supabase as any).from(shareTable).delete().eq(shareFk as any, itemId);
      const { error } = await (supabase as any).from(table).delete().eq("id", itemId);
      if (error) throw error;

      setMsg(t("common.deleted"));
      if (onDeleted) onDeleted();
      else window.location.href = defaultRedirect;
    } catch (e: any) {
      setErrorText(e?.message ?? t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  const body = (
    <div className={compact ? "grid gap-5" : "mt-4 grid gap-5"}>
      {/* Title */}
      <div className="grid gap-2">
        <div className="text-sm font-semibold">{t("common.title")}</div>
        <input
          className="input"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder={t("common.title")}
        />
      </div>

      {/* Folder */}
      <div className="grid gap-3">
        <div className="text-sm font-semibold">{t("folders.folder")}</div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <select
              className="select"
              value={selectedFolderId ?? ""}
              onChange={(e) => setSelectedFolderId(e.target.value ? e.target.value : null)}
            >
              <option value="">{rootLabel}</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <button type="button" className="btn btn-secondary" onClick={() => setSelectedFolderId(null)} disabled={saving}>
            {t("common.reset")}
          </button>
        </div>

        <div className="card-soft p-4">
          <div className="text-xs font-semibold opacity-80">{t("folders.new")}</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <input
              className="input sm:col-span-2"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder={t("folders.newPlaceholder")}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={createFolder}
              disabled={creatingFolder || !newFolderName.trim()}
            >
              {creatingFolder ? t("common.saving") : t("folders.create")}
            </button>
          </div>
        </div>
      </div>

      {/* Sharing */}
      <div className="grid gap-3">
        <div className="text-sm font-semibold">{t("sharing.title")}</div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`chip ${shareMode === "private" ? "chip-active" : ""}`}
            onClick={() => setShareMode("private")}
            disabled={saving}
          >
            {t("common.private")}
          </button>
          <button
            type="button"
            className={`chip ${shareMode === "groups" ? "chip-active" : ""}`}
            onClick={() => setShareMode("groups")}
            disabled={saving}
          >
            {t("sharing.someGroups")}
          </button>
          <button
            type="button"
            className={`chip ${shareMode === "public" ? "chip-active" : ""}`}
            onClick={() => setShareMode("public")}
            disabled={saving}
          >
            {t("common.public")}
          </button>
        </div>

        {shareMode === "groups" ? (
          <div className="grid gap-2">
            {loadingShares ? <div className="text-xs text-white/70">{t("common.loading")}</div> : null}
            <GroupMultiPicker value={groupIds} onChange={setGroupIds} defaultSelectGroupId={activeGroupId} />
          </div>
        ) : null}
      </div>

      {errorText ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          ❌ {errorText}
        </div>
      ) : null}

      {msg ? <div className="text-sm text-white/80">✅ {msg}</div> : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
        <button
          type="button"
          className="btn btn-primary"
          onClick={saveAll}
          disabled={saving || !draftTitle.trim() || (shareMode === "groups" && groupIds.length === 0)}
        >
          {saving ? t("common.saving") : t("common.save")}
        </button>

        <button type="button" className="btn btn-danger" onClick={deleteItem} disabled={saving}>
          {t("common.delete")}
        </button>
      </div>
    </div>
  );

  if (compact) return body;

  return (
    <details className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.05]">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-0.5 text-xs text-white/60">{subtitle}</div>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/70">
          <span className="hidden sm:inline">{t("common.edit")}</span>
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.02]">▾</span>
        </div>
      </summary>

      {body}
    </details>
  );
}
