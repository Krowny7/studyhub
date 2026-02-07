"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";

export type TagRow = { id: string; name: string; color?: string | null };

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

function readCommaList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function TagMultiSelect({
  tags,
  value,
  onChange,
  name,
  allowCreate = true,
  label,
  placeholder,
  className
}: {
  tags: TagRow[];
  value: string[];
  onChange: (next: string[]) => void;
  name?: string;
  allowCreate?: boolean;
  label?: string;
  placeholder?: string;
  className?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useI18n();
  const isDesktop = useIsDesktop();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !isDesktop) return;
    const onDown = (e: MouseEvent) => {
      const w = wrapperRef.current;
      const target = e.target as Node | null;
      if (w && target && !w.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, isDesktop]);

  const selected = useMemo(() => {
    const set = new Set(value);
    return tags.filter((tg) => set.has(tg.id));
  }, [tags, value]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((tg) => tg.name.toLowerCase().includes(q));
  }, [tags, search]);

  const buttonLabel = useMemo(() => {
    if (selected.length === 0) return placeholder ?? t("tags.none");
    return selected.map((s) => s.name).join(", ");
  }, [placeholder, selected, t]);

  async function createTag() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setMsg(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not logged in");

      const res = await supabase
        .from("tags")
        .insert({ owner_id: auth.user.id, name })
        .select("id")
        .maybeSingle();
      if (res.error) throw res.error;

      const id = (res.data as any)?.id as string | undefined;
      if (id) onChange(Array.from(new Set([...value, id])));
      setNewName("");
      setMsg("✅");
      // Let the parent refresh tags list if desired; in this simple version, we rely on page reload
      window.location.reload();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    const set = new Set(value);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange(Array.from(set));
  }

  const panel = (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold opacity-80">{label ?? t("tags.title")}</div>
          <div className="mt-1 text-xs opacity-60 truncate">{selected.length ? buttonLabel : t("tags.none")}</div>
        </div>
        <button type="button" className="btn btn-ghost px-3" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>

      <input
        className="input"
        value={search}
        placeholder={t("common.search")}
        onChange={(e) => setSearch(e.target.value)}
      />

      {allowCreate ? (
        <div className="card-soft p-3">
          <div className="text-xs opacity-70">{t("tags.new")}</div>
          <div className="mt-2 flex gap-2">
            <input
              className="input flex-1"
              value={newName}
              placeholder={t("tags.newPlaceholder")}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || !newName.trim()}
              onClick={createTag}
            >
              {busy ? t("common.saving") : t("tags.create")}
            </button>
          </div>
          {msg ? <div className="mt-2 text-sm">{msg}</div> : null}
        </div>
      ) : null}

      <div className="overflow-auto rounded-2xl border border-white/10 bg-white/[0.02] p-2" style={{ maxHeight: isDesktop ? 320 : "48vh" }}>
        <div className="grid gap-1">
          {filtered.map((tg) => {
            const active = value.includes(tg.id);
            return (
              <button
                key={tg.id}
                type="button"
                className={
                  "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/[0.06] " +
                  (active ? "bg-white/[0.10] border border-white/10" : "")
                }
                onClick={() => toggle(tg.id)}
              >
                <span className="truncate text-sm">{tg.name}</span>
                <span className="text-xs opacity-60">{active ? "✓" : ""}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button type="button" className="btn btn-secondary w-full" onClick={() => setOpen(false)}>
        {t("common.close")}
      </button>
    </div>
  );

  return (
    <div ref={wrapperRef} className={"relative " + (className ?? "")}
    >
      {name ? <input type="hidden" name={name} value={value.join(",")} /> : null}

      <button
        type="button"
        className="btn btn-secondary w-full justify-between gap-3 text-left"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1 truncate">{buttonLabel}</span>
        <span className="opacity-70">▾</span>
      </button>

      {selected.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((tg) => (
            <button
              key={tg.id}
              type="button"
              className="chip chip-active text-xs"
              onClick={() => toggle(tg.id)}
              title={t("tags.remove")}
            >
              {tg.name} ×
            </button>
          ))}
        </div>
      ) : null}

      {open ?
        isDesktop ? (
          <div className="absolute right-0 z-[90] mt-2 w-[min(520px,92vw)] rounded-2xl border border-white/10 bg-neutral-950/95 p-4 shadow-2xl backdrop-blur">
            {panel}
          </div>
        ) : (
          <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
            <button type="button" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-auto rounded-t-3xl border border-white/10 bg-neutral-950/95 p-4 shadow-2xl backdrop-blur">
              {panel}
            </div>
          </div>
        )
      : null}
    </div>
  );
}
