"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";
import { FolderTreePicker, type FolderNode } from "@/components/FolderTreePicker";
import { FolderManager } from "@/components/FolderManager";

export type FolderKind = "documents" | "flashcards" | "quizzes" | "exercises";

type Folder = FolderNode;

const RECENTS_KEY = (kind: FolderKind) => `cfa-hub:recentFolders:${kind}`;

function readRecents(kind: FolderKind): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY(kind));
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function writeRecents(kind: FolderKind, ids: string[]) {
  try {
    localStorage.setItem(RECENTS_KEY(kind), JSON.stringify(ids.slice(0, 8)));
  } catch {
    // ignore
  }
}

function formatSupabaseError(err: any): string {
  if (!err) return "Unknown error";
  const msg = err?.message ?? err?.error_description ?? err?.hint ?? err?.details;
  if (typeof msg === "string" && msg.trim().length > 0) return msg;

  try {
    const parts: string[] = [];
    if (err?.code) parts.push(`code=${err.code}`);
    if (err?.status) parts.push(`status=${err.status}`);
    if (err?.statusText) parts.push(`statusText=${err.statusText}`);
    const s = JSON.stringify(err, Object.getOwnPropertyNames(err));
    if (s && s !== "{}") parts.push(s);
    return parts.length ? parts.join(" | ") : String(err);
  } catch {
    return String(err);
  }
}

export function FolderPicker({
  kind,
  value,
  onChange,
  compact = false
}: {
  kind: FolderKind;
  value: string | null;
  onChange: (next: string | null) => void;
  /**
   * Compact mode: by default, only shows the folder selector.
   * Folder creation/management is tucked into an "Advanced" disclosure.
   */
  compact?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useI18n();

  const [folders, setFolders] = useState<Folder[]>([]);
  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  // Keep the default parent for new folders aligned with the current selection.
  useEffect(() => {
    setNewParentId(value ?? null);
  }, [value]);

  // Load recents per kind
  useEffect(() => {
    setRecentIds(readRecents(kind));
  }, [kind]);

  // Persist recents when selection changes
  useEffect(() => {
    if (!value) return;
    setRecentIds((prev) => {
      const next = [value, ...prev.filter((id) => id !== value)].slice(0, 8);
      writeRecents(kind, next);
      return next;
    });
  }, [value, kind]);

  async function refresh() {
    setErrorText(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setFolders([]);
        return;
      }

      const { data } = await supabase
        .from("library_folders")
        .select("id,name,parent_id")
        .eq("kind", kind)
        .order("name", { ascending: true })
        .throwOnError();

      setFolders((data ?? []) as any);
    } catch (err: any) {
      console.error("FolderPicker.refresh error:", err);
      setFolders([]);
      setErrorText(formatSupabaseError(err));
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const picker = (
    <div className="w-full">
      <div className="text-sm font-medium">{t("folders.folder")}</div>
      <div className="mt-2">
        <FolderTreePicker
          folders={folders}
          value={value}
          onChange={onChange}
          label={t("folders.pick")}
          noneLabel={t("folders.none")}
          recentIds={recentIds}
        />
      </div>
    </div>
  );

  const advancedContent = (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <div className="text-xs opacity-70">{t("folders.new")}</div>
        <FolderTreePicker
          folders={folders}
          value={newParentId}
          onChange={setNewParentId}
          label={t("folders.pickParent")}
          noneLabel={t("folders.none")}
          recentIds={recentIds}
          buttonClassName="btn btn-secondary w-full justify-between gap-3 text-left"
        />

        <input
          className="input"
          value={newName}
          placeholder={t("folders.newPlaceholder")}
          onChange={(e) => setNewName(e.target.value)}
        />

        <button
          type="button"
          className="btn btn-secondary w-full whitespace-nowrap"
          disabled={busy || !newName.trim()}
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

              const name = newName.trim();

              await supabase
                .from("library_folders")
                .insert({
                  owner_id: user.id,
                  kind,
                  name,
                  parent_id: newParentId ?? null
                })
                .throwOnError();

              setNewName("");
              await refresh();
            } catch (err: any) {
              console.error("FolderPicker.insert error:", err);
              setErrorText(formatSupabaseError(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? t("common.saving") : t("folders.create")}
        </button>
      </div>

      <details className="group card-soft">
        <summary className="cursor-pointer list-none select-none rounded-xl px-4 py-3 transition hover:bg-white/[0.06]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">{t("folders.manageTitle")}</div>
              <div className="mt-1 text-xs opacity-70">{t("folders.manageDesc")}</div>
            </div>
            <div className="text-sm opacity-60 transition group-open:rotate-180">▼</div>
          </div>
        </summary>

        <div className="border-t border-white/10 p-4">
          <FolderManager kind={kind} folders={folders} onFoldersChanged={refresh} defaultFolderId={value ?? null} />
        </div>
      </details>
    </div>
  );

  return (
    <div className="card-soft p-4">
      {picker}

      {errorText ? (
        <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {errorText}
        </div>
      ) : null}

      {compact ? (
        <div className="mt-3">
          <details className="group card-soft">
            <summary className="cursor-pointer list-none select-none rounded-xl px-4 py-3 transition hover:bg-white/[0.06]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">{t("common.advanced")}</div>
                <div className="text-sm opacity-60 transition group-open:rotate-180">▼</div>
              </div>
            </summary>
            <div className="border-t border-white/10 p-4">{advancedContent}</div>
          </details>
        </div>
      ) : (
        <div className="mt-3">{advancedContent}</div>
      )}
    </div>
  );
}
