"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";
import type { FolderKind } from "@/components/FolderPicker";
import type { FolderNode } from "@/components/FolderTreePicker";
import { FolderTreeView } from "@/components/FolderTreeView";
import { FolderTreePicker } from "@/components/FolderTreePicker";

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

function useIsDesktop(minWidth = 768) {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [minWidth]);
  return isDesktop;
}

export function FolderManager({
  kind,
  folders,
  onFoldersChanged,
  defaultFolderId
}: {
  kind: FolderKind;
  folders: FolderNode[];
  onFoldersChanged: () => Promise<void> | void;
  defaultFolderId?: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useI18n();
  const isDesktop = useIsDesktop();

  const [openMobile, setOpenMobile] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(defaultFolderId ?? null);
  const selected = useMemo(() => folders.find((f) => f.id === selectedId) ?? null, [folders, selectedId]);

  const invalidParentIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const d = descendantsOf(folders, selectedId);
    d.add(selectedId);
    return d;
  }, [folders, selectedId]);

  const parentPickerFolders = useMemo(() => {
    if (!selectedId) return folders;
    return folders.filter((f) => !invalidParentIds.has(f.id));
  }, [folders, invalidParentIds, selectedId]);

  const [rename, setRename] = useState("");
  const [moveParent, setMoveParent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setRename(selected?.name ?? "");
    setMoveParent(selected?.parent_id ?? null);
  }, [selected?.id]);

  async function saveRename() {
    if (!selected) return;
    const name = rename.trim();
    if (!name) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await supabase
        .from("library_folders")
        .update({ name })
        .eq("id", selected.id)
        .eq("kind", kind);
      if (res.error) throw res.error;
      setMsg("✅");
      await onFoldersChanged();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveMove() {
    if (!selected) return;
    const parent_id = moveParent ?? null;
    if (invalidParentIds.has(parent_id as any)) {
      setMsg(`❌ ${t("common.error")}`);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await supabase
        .from("library_folders")
        .update({ parent_id })
        .eq("id", selected.id)
        .eq("kind", kind);
      if (res.error) throw res.error;
      setMsg("✅");
      await onFoldersChanged();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setBusy(false);
    }
  }

  const content = (
    <div className="grid gap-3">
      <div className="text-sm font-semibold opacity-80">{t("folders.manage")}</div>

      <div className={"grid gap-3 " + (isDesktop ? "md:grid-cols-12" : "")}> 
        <div className={isDesktop ? "md:col-span-6" : ""}>
          <FolderTreeView
            folders={folders}
            value={selectedId}
            onChange={setSelectedId}
            disabledIds={undefined}
            heightPx={isDesktop ? 380 : 320}
          />
        </div>

        <div className={isDesktop ? "md:col-span-6" : ""}>
          {selected ? (
            <div className="card-soft p-4">
              <div className="text-xs opacity-70">{t("folders.selected")}</div>
              <div className="mt-1 font-medium truncate" title={selected.name}>
                {selected.name}
              </div>

              <div className="mt-4 grid gap-2">
                <div className="text-xs opacity-70">{t("folders.rename")}</div>
                <div className="flex gap-2">
                  <input className="input flex-1" value={rename} onChange={(e) => setRename(e.target.value)} />
                  <button className="btn btn-secondary" type="button" disabled={busy || !rename.trim()} onClick={saveRename}>
                    {t("common.save")}
                  </button>
                </div>

                <div className="mt-2 text-xs opacity-70">{t("folders.move")}</div>
                <FolderTreePicker
                  folders={parentPickerFolders}
                  value={moveParent}
                  onChange={setMoveParent}
                  label={t("folders.pickParent")}
                  noneLabel={t("folders.none")}
                  buttonClassName="btn btn-secondary w-full justify-between gap-3 text-left"
                />
                <button className="btn btn-secondary" type="button" disabled={busy} onClick={saveMove}>
                  {t("folders.applyMove")}
                </button>
              </div>

              {msg ? <div className="mt-2 text-sm">{msg}</div> : null}
            </div>
          ) : (
            <div className="card-soft p-4 text-sm opacity-70">{t("folders.pickToManage")}</div>
          )}
        </div>
      </div>
    </div>
  );

  if (isDesktop) return content;

  // Mobile: open a sheet
  return (
    <div>
      <button type="button" className="btn btn-secondary w-full" onClick={() => setOpenMobile(true)}>
        {t("folders.manage")}
      </button>

      {openMobile ? (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0 bg-black/60" onClick={() => setOpenMobile(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-auto rounded-t-3xl border border-white/10 bg-neutral-950/95 p-4 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold opacity-80">{t("folders.manage")}</div>
              <button type="button" className="btn btn-ghost px-3" onClick={() => setOpenMobile(false)}>
                ✕
              </button>
            </div>
            <div className="mt-3">{content}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
