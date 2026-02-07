"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";

export type SavedViewRow = {
  id: string;
  name: string;
  kind: "documents" | "flashcards" | "quizzes" | "exercises";
  query: any;
};

function toQueryString(obj: any): string {
  if (!obj) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.join(","));
    } else {
      const s = String(v);
      if (s.trim().length) sp.set(k, s);
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function SavedViewsBar({
  kind,
  basePath,
  currentQuery,
  views
}: {
  kind: "documents" | "flashcards" | "quizzes" | "exercises";
  basePath: string;
  currentQuery: any;
  views: SavedViewRow[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");

  const options = useMemo(() => {
    return [{ id: "", name: t("views.none"), query: null } as any].concat(views as any);
  }, [views, t]);

  async function saveView() {
    setMsg(null);
    const name = window.prompt(t("views.namePrompt"));
    if (!name) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not logged in");
      const res = await supabase
        .from("saved_views")
        .insert({ owner_id: auth.user.id, kind, name: name.trim(), query: currentQuery })
        .select("id")
        .maybeSingle();
      if (res.error) throw res.error;
      setMsg("✅");
      window.location.reload();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteView(id: string) {
    if (!id) return;
    const ok = window.confirm(t("views.deleteConfirm"));
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await supabase.from("saved_views").delete().eq("id", id);
      if (res.error) throw res.error;
      setMsg("✅");
      window.location.reload();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="group card-soft">
      <summary className="cursor-pointer list-none select-none rounded-xl px-4 py-3 transition hover:bg-white/[0.06]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-medium">{t("views.title")}</div>
          <div className="flex items-center gap-2">
            <div className="text-sm opacity-60 transition group-open:rotate-180">▼</div>
          </div>
        </div>
      </summary>

      <div className="border-t border-white/10 p-4">
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
          <select
            className="select w-full sm:w-auto sm:min-w-[240px]"
            value={selectedId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedId(id);
              const v = views.find((x) => x.id === id);
              const qs = toQueryString(v?.query ?? null);
              window.location.href = `${basePath}${qs}`;
            }}
          >
            {options.map((o: any) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>

          <button type="button" className="btn btn-secondary" disabled={busy} onClick={saveView}>
            {t("views.save")}
          </button>

          {views.length ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => {
                if (!selectedId) return;
                deleteView(selectedId);
              }}
              title={t("views.deleteHint")}
            >
              {t("views.delete")}
            </button>
          ) : null}
        </div>

        {msg ? <div className="mt-2 text-sm">{msg}</div> : null}
        <div className="mt-2 text-xs opacity-60">{t("views.note")}</div>
      </div>
    </details>
  );
}
