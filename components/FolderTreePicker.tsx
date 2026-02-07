"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useI18n } from "@/components/I18nProvider";

export type FolderNode = { id: string; name: string; parent_id: string | null };

function buildMaps(folders: FolderNode[]) {
  const byId = new Map<string, FolderNode>();
  const children = new Map<string | null, FolderNode[]>();

  for (const f of folders) {
    byId.set(f.id, f);
    const key = f.parent_id ?? null;
    const arr = children.get(key) ?? [];
    arr.push(f);
    children.set(key, arr);
  }

  // Stable alpha sort at each level
  for (const [k, arr] of children.entries()) {
    arr.sort((a, b) => a.name.localeCompare(b.name));
    children.set(k, arr);
  }

  return { byId, children };
}

function buildPath(byId: Map<string, FolderNode>, id: string): FolderNode[] {
  const out: FolderNode[] = [];
  let cur = byId.get(id);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.push(cur);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return out.reverse();
}

function joinPath(nodes: FolderNode[]) {
  return nodes.map((n) => n.name).join(" / ");
}

function computeVisibleIds(
  folders: FolderNode[],
  byId: Map<string, FolderNode>,
  query: string
): Set<string> {
  const q = query.trim().toLowerCase();
  if (!q) return new Set(folders.map((f) => f.id));

  const vis = new Set<string>();
  for (const f of folders) {
    // Match on full path so searching "Ethics" matches nested items too.
    const path = joinPath(buildPath(byId, f.id)).toLowerCase();
    if (path.includes(q)) {
      // add self + ancestors
      let cur: FolderNode | undefined = f;
      const seen = new Set<string>();
      while (cur && !seen.has(cur.id)) {
        seen.add(cur.id);
        vis.add(cur.id);
        cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
      }
    }
  }
  return vis;
}

function computeAutoExpanded(
  byId: Map<string, FolderNode>,
  visibleIds: Set<string>
): Set<string> {
  // Expand all ancestors of visible nodes
  const expanded = new Set<string>();
  for (const id of visibleIds) {
    const path = buildPath(byId, id);
    for (const n of path) expanded.add(n.id);
  }
  return expanded;
}

function useBodyScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
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

export function FolderTreePicker({
  folders,
  value,
  onChange,
  label,
  noneLabel,
  recentIds,
  onPickRecent,
  buttonClassName
}: {
  folders: FolderNode[];
  value: string | null;
  onChange: (next: string | null) => void;
  label: string;
  noneLabel: string;
  recentIds?: string[];
  onPickRecent?: (id: string) => void;
  buttonClassName?: string;
}) {
  const { t } = useI18n();

  const isDesktop = useIsDesktop();

  const { byId, children } = useMemo(() => buildMaps(folders), [folders]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useBodyScrollLock(open && !isDesktop);

  const selectedPath = useMemo(() => {
    if (!value) return null;
    return buildPath(byId, value);
  }, [byId, value]);

  const selectedLabel = useMemo(() => {
    if (!value) return noneLabel;
    if (!selectedPath?.length) return noneLabel;
    return joinPath(selectedPath);
  }, [noneLabel, selectedPath, value]);

  const visibleIds = useMemo(() => computeVisibleIds(folders, byId, search), [folders, byId, search]);

  // When searching, auto-expand relevant branches.
  useEffect(() => {
    if (!search.trim()) return;
    setExpanded(computeAutoExpanded(byId, visibleIds));
  }, [byId, search, visibleIds]);

  // On open: focus close button (mobile Safari friendliness)
  useEffect(() => {
    if (!open) return;
    const tt = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => window.clearTimeout(tt);
  }, [open]);

  // Desktop: close on outside click
  useEffect(() => {
    if (!open || !isDesktop) return;
    const onDown = (e: MouseEvent) => {
      const w = wrapperRef.current;
      if (!w) return;
      const target = e.target as Node | null;
      if (target && !w.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, isDesktop]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onDialogKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }

    if (e.key !== "Tab") return;

    const root = panelRef.current;
    if (!root) return;

    const focusable = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.getAttribute("aria-hidden") !== "true");

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && (active === first || !root.contains(active))) {
      e.preventDefault();
      last.focus();
    }
  }

  const recentFolders = useMemo(() => {
    if (!recentIds?.length) return [];
    const map = byId;
    return recentIds
      .map((id) => map.get(id))
      .filter(Boolean) as FolderNode[];
  }, [recentIds, byId]);

  function renderNode(node: FolderNode, depth: number) {
    if (!visibleIds.has(node.id)) return null;

    const kids = children.get(node.id) ?? [];
    const hasKids = kids.length > 0;
    const isExpanded = expanded.has(node.id) || (search.trim().length > 0 && hasKids);
    const isSelected = value === node.id;

    return (
      <div key={node.id} className="select-none">
        <div
          className={
            "flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/[0.06] " +
            (isSelected ? "bg-white/[0.10] border border-white/10" : "")
          }
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          {hasKids ? (
            <button
              type="button"
              className="btn btn-ghost px-2 py-1 min-h-0 h-8"
              aria-label={isExpanded ? "Collapse" : "Expand"}
              onClick={() => toggleExpand(node.id)}
            >
              {isExpanded ? "▾" : "▸"}
            </button>
          ) : (
            <span className="inline-block w-9" />
          )}

          <button
            type="button"
            className={
              "flex-1 text-left text-sm py-2 px-2 rounded-lg " +
              (isSelected ? "text-white" : "text-white/90")
            }
            onClick={() => {
              onChange(node.id);
              onPickRecent?.(node.id);
              setOpen(false);
            }}
            title={joinPath(buildPath(byId, node.id))}
          >
            <div className="truncate">{node.name}</div>
          </button>
        </div>

        {hasKids && isExpanded ? (
          <div className="mt-1">
            {kids.map((k) => renderNode(k, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  }

  // Roots
  const roots = children.get(null) ?? [];

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        className={
          buttonClassName ??
          "btn btn-secondary w-full justify-between gap-3 text-left"
        }
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
        <span className="opacity-70">▾</span>
      </button>

      {open ? (
        isDesktop ? (
          <div
            ref={panelRef}
            className="absolute right-0 z-[80] mt-2 w-[min(520px,92vw)] rounded-2xl border border-white/10 bg-neutral-950/95 p-4 shadow-2xl backdrop-blur"
            onKeyDown={onDialogKeyDown}
            role="dialog"
            aria-modal="false"
            aria-label={label}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold opacity-80">{label}</div>
                <div className="mt-1 text-xs opacity-60 truncate">
                  {selectedPath?.length ? joinPath(selectedPath) : noneLabel}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost px-3"
                onClick={() => setOpen(false)}
                ref={closeButtonRef}
              >
                ✕
              </button>
            </div>

            <div className="mt-3 grid gap-2">
              <input
                className="input"
                value={search}
                placeholder={t("common.search")}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={t("common.search")}
              />

              {recentFolders.length ? (
                <div className="flex flex-wrap gap-2">
                  {recentFolders.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={(value === f.id ? "chip chip-active" : "chip") + " text-xs"}
                      onClick={() => {
                        onChange(f.id);
                        onPickRecent?.(f.id);
                        setOpen(false);
                      }}
                      title={joinPath(buildPath(byId, f.id))}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={
                    "btn btn-secondary w-full justify-start " +
                    (!value ? "border-white/20 bg-white/[0.08]" : "")
                  }
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  {noneLabel}
                </button>
              </div>

              <div className="mt-1 overflow-auto rounded-2xl border border-white/10 bg-white/[0.02] p-2" style={{ maxHeight: "48vh" }}>
                {roots.length ? (
                  <div className="grid gap-1">
                    {roots.map((r) => renderNode(r, 0))}
                  </div>
                ) : (
                  <div className="p-3 text-sm opacity-70">{t("common.loading")}</div>
                )}
              </div>

              <div className="mt-2">
                <button type="button" className="btn btn-secondary w-full" onClick={() => setOpen(false)}>
                  {t("common.close")}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[70]"
            onKeyDown={onDialogKeyDown}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/60"
              aria-label={t("common.close")}
              tabIndex={-1}
              onClick={() => setOpen(false)}
            />

            <div
              ref={panelRef}
              className="absolute bottom-0 left-0 right-0 max-h-[85vh] rounded-t-3xl border border-white/10 bg-neutral-950/95 p-4 shadow-2xl backdrop-blur"
              aria-label={label}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold opacity-80">{label}</div>
                  <div className="mt-1 text-xs opacity-60 truncate">
                    {selectedPath?.length ? joinPath(selectedPath) : noneLabel}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost px-3"
                  onClick={() => setOpen(false)}
                  ref={closeButtonRef}
                >
                  ✕
                </button>
              </div>

              <div className="mt-3 grid gap-2">
                <input
                  className="input"
                  value={search}
                  placeholder={t("common.search")}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label={t("common.search")}
                />

                {recentFolders.length ? (
                  <div className="flex flex-wrap gap-2">
                    {recentFolders.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={(value === f.id ? "chip chip-active" : "chip") + " text-xs"}
                        onClick={() => {
                          onChange(f.id);
                          onPickRecent?.(f.id);
                          setOpen(false);
                        }}
                        title={joinPath(buildPath(byId, f.id))}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={
                      "btn btn-secondary w-full justify-start " +
                      (!value ? "border-white/20 bg-white/[0.08]" : "")
                    }
                    onClick={() => {
                      onChange(null);
                      setOpen(false);
                    }}
                  >
                    {noneLabel}
                  </button>
                </div>

                <div className="mt-1 overflow-auto rounded-2xl border border-white/10 bg-white/[0.02] p-2" style={{ maxHeight: "48vh" }}>
                  {roots.length ? (
                    <div className="grid gap-1">
                      {roots.map((r) => renderNode(r, 0))}
                    </div>
                  ) : (
                    <div className="p-3 text-sm opacity-70">{t("common.loading")}</div>
                  )}
                </div>

                <div className="mt-2">
                  <button type="button" className="btn btn-secondary w-full" onClick={() => setOpen(false)}>
                    {t("common.close")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
