"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";
import type { FolderNode } from "@/components/FolderTreePicker";

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

function computeVisibleIds(folders: FolderNode[], byId: Map<string, FolderNode>, query: string): Set<string> {
  const q = query.trim().toLowerCase();
  if (!q) return new Set(folders.map((f) => f.id));

  const vis = new Set<string>();
  for (const f of folders) {
    const path = joinPath(buildPath(byId, f.id)).toLowerCase();
    if (path.includes(q)) {
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

function computeAutoExpanded(byId: Map<string, FolderNode>, visibleIds: Set<string>): Set<string> {
  const expanded = new Set<string>();
  for (const id of visibleIds) {
    const path = buildPath(byId, id);
    for (const n of path) expanded.add(n.id);
  }
  return expanded;
}

export function FolderTreeView({
  folders,
  value,
  onChange,
  heightPx = 360,
  disabledIds,
  header
}: {
  folders: FolderNode[];
  value: string | null;
  onChange: (id: string | null) => void;
  heightPx?: number;
  disabledIds?: Set<string>;
  header?: ReactNode;
}) {
  const { t } = useI18n();
  const { byId, children } = useMemo(() => buildMaps(folders), [folders]);

  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const visibleIds = useMemo(() => computeVisibleIds(folders, byId, search), [folders, byId, search]);

  useEffect(() => {
    if (!search.trim()) return;
    setExpanded(computeAutoExpanded(byId, visibleIds));
  }, [byId, visibleIds, search]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderNode(node: FolderNode, depth: number) {
    if (!visibleIds.has(node.id)) return null;
    const kids = children.get(node.id) ?? [];
    const hasKids = kids.length > 0;
    const isExpanded = expanded.has(node.id) || (search.trim().length > 0 && hasKids);
    const isSelected = value === node.id;
    const isDisabled = disabledIds?.has(node.id) ?? false;

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
              (isDisabled ? "opacity-40 cursor-not-allowed" : "")
            }
            disabled={isDisabled}
            onClick={() => onChange(node.id)}
            title={joinPath(buildPath(byId, node.id))}
          >
            <div className="truncate">{node.name}</div>
          </button>
        </div>

        {hasKids && isExpanded ? (
          <div className="mt-1">{kids.map((k) => renderNode(k, depth + 1))}</div>
        ) : null}
      </div>
    );
  }

  const roots = children.get(null) ?? [];

  return (
    <div className="grid gap-2">
      {header ? header : null}
      <input
        className="input"
        value={search}
        placeholder={t("common.search")}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div
        className="overflow-auto rounded-2xl border border-white/10 bg-white/[0.02] p-2"
        style={{ maxHeight: heightPx }}
      >
        {roots.length ? <div className="grid gap-1">{roots.map((r) => renderNode(r, 0))}</div> : null}
      </div>
      <button type="button" className="btn btn-secondary" onClick={() => onChange(null)}>
        {t("folders.none")}
      </button>
    </div>
  );
}
