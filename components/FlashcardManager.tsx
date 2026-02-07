"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";
import { ImageInsertButton } from "@/components/ImageInsertButton";

type CardRow = {
  id: string;
  front: string;
  back: string;
  position: number;
};

function appendTag(prev: string, tag: string) {
  const p = (prev ?? "").toString();
  if (!p.trim()) return tag;
  const endsWithNl = p.endsWith("\n");
  return p + (endsWithNl ? "" : "\n") + tag;
}

function previewText(v: string) {
  const s = (v ?? "").toString();
  const first = s
    .split("\n")
    .find((l) => !!l.trim() && !l.trim().match(/^\[\[img:(.+)\]\]$/i)) ??
    "";
  return first.length > 90 ? first.slice(0, 87) + "…" : first;
}

export function FlashcardManager({
  setId,
  initialCards
}: {
  setId: string;
  initialCards: CardRow[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { t } = useI18n();

  const [cards, setCards] = useState<CardRow[]>(initialCards ?? []);

  // Keep in sync when the server re-renders (router.refresh).
  useEffect(() => {
    setCards(initialCards ?? []);
  }, [initialCards]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");

  const filtered = (cards ?? []).filter((c) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return (c.front ?? "").toLowerCase().includes(needle) || (c.back ?? "").toLowerCase().includes(needle);
  });

  async function refresh() {
    const { data, error } = await supabase
      .from("flashcards")
      .select("id,front,back,position")
      .eq("set_id", setId)
      .order("position", { ascending: true });
    if (!error) setCards((data ?? []) as any);
  }

  async function normalizePositions(nextCards?: CardRow[]) {
    const rows = [...(nextCards ?? cards)].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const tasks = rows.map((c, idx) => {
      if (c.position === idx + 1) return null;
      return supabase.from("flashcards").update({ position: idx + 1 }).eq("id", c.id).eq("set_id", setId);
    });
    const real = tasks.filter(Boolean) as any[];
    if (real.length === 0) return;
    const res = await Promise.all(real);
    const err = res.find((r) => r?.error)?.error;
    if (err) throw err;
  }

  function openEdit(c: CardRow) {
    setMsg(null);
    setEditId(c.id);
    setEditFront(c.front ?? "");
    setEditBack(c.back ?? "");
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editId) return;
    setBusy(true);
    setMsg(null);
    try {
      const upd = await supabase
        .from("flashcards")
        .update({ front: editFront, back: editBack })
        .eq("id", editId)
        .eq("set_id", setId);
      if (upd.error) throw upd.error;

      setCards((prev) => prev.map((c) => (c.id === editId ? { ...c, front: editFront, back: editBack } : c)));
      setEditOpen(false);
      setEditId(null);
      setMsg(t("common.saved"));
      router.refresh();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteCard(id: string) {
    const ok = window.confirm(t("flashcards.confirmDeleteCard"));
    if (!ok) return;

    setBusy(true);
    setMsg(null);
    try {
      const del = await supabase.from("flashcards").delete().eq("id", id).eq("set_id", setId);
      if (del.error) throw del.error;

      const next = cards.filter((c) => c.id !== id);
      setCards(next);
      await normalizePositions(next);
      await refresh();
      setMsg(t("common.deleted"));
      router.refresh();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setBusy(false);
    }
  }

  async function move(id: string, dir: -1 | 1) {
    setMsg(null);
    const idx = cards.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= cards.length) return;

    const a = cards[idx];
    const b = cards[j];

    setBusy(true);
    try {
      // Swap positions in DB
      const r1 = await supabase.from("flashcards").update({ position: b.position }).eq("id", a.id).eq("set_id", setId);
      if (r1.error) throw r1.error;
      const r2 = await supabase.from("flashcards").update({ position: a.position }).eq("id", b.id).eq("set_id", setId);
      if (r2.error) throw r2.error;

      // Optimistic local swap
      const next = [...cards];
      next[idx] = { ...a, position: b.position };
      next[j] = { ...b, position: a.position };
      next.sort((x, y) => (x.position ?? 0) - (y.position ?? 0));
      setCards(next);
      router.refresh();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-soft p-4 min-w-0 max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{t("flashcards.manageTitle")}</h3>
        <div className="text-xs opacity-70">{cards.length}</div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          className="input w-full sm:w-[320px]"
          placeholder={t("flashcards.searchCards")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {msg ? <div className="text-sm break-words [overflow-wrap:anywhere]">{msg}</div> : null}
      </div>

      <div className="mt-3 grid gap-2">
        {filtered.length === 0 ? (
          <div className="text-sm opacity-70">{t("flashcards.none")}</div>
        ) : (
          filtered.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/10 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs opacity-70">#{c.position}</div>
                  <div className="mt-1 text-sm font-medium break-words [overflow-wrap:anywhere]">{previewText(c.front)}</div>
                  <div className="mt-1 text-sm opacity-80 break-words [overflow-wrap:anywhere]">{previewText(c.back)}</div>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
                  <button
                    type="button"
                    className="btn btn-secondary w-full sm:w-auto"
                    onClick={() => move(c.id, -1)}
                    disabled={busy}
                  >
                    {t("flashcards.moveUp")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary w-full sm:w-auto"
                    onClick={() => move(c.id, 1)}
                    disabled={busy}
                  >
                    {t("flashcards.moveDown")}
                  </button>
                  <button type="button" className="btn btn-secondary w-full sm:w-auto" onClick={() => openEdit(c)} disabled={busy}>
                    {t("common.edit")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger w-full sm:w-auto"
                    onClick={() => deleteCard(c.id)}
                    disabled={busy}
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {editOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-neutral-950 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold">{t("flashcards.editCard")}</div>
              <button type="button" className="btn btn-ghost" onClick={() => setEditOpen(false)} disabled={busy}>
                ✕
              </button>
            </div>

            <div className="mt-3 grid gap-3">
              <div className="grid gap-2">
                <textarea
                  className="box-border w-full min-w-0 max-w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm"
                  rows={5}
                  value={editFront}
                  onChange={(e) => setEditFront(e.target.value)}
                  placeholder={t("flashcards.frontPlaceholder")}
                />
                <div className="flex items-center justify-end">
                  <ImageInsertButton onInsert={(tag) => setEditFront((p) => appendTag(p, tag))} />
                </div>
              </div>

              <div className="grid gap-2">
                <textarea
                  className="box-border w-full min-w-0 max-w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm"
                  rows={5}
                  value={editBack}
                  onChange={(e) => setEditBack(e.target.value)}
                  placeholder={t("flashcards.backPlaceholder")}
                />
                <div className="flex items-center justify-end">
                  <ImageInsertButton onInsert={(tag) => setEditBack((p) => appendTag(p, tag))} />
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(false)} disabled={busy}>
                  {t("common.cancel")}
                </button>
                <button type="button" className="btn btn-primary" onClick={saveEdit} disabled={busy}>
                  {busy ? t("common.saving") : t("common.save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
