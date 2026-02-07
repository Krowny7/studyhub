"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";

type Mode = "import" | "export";
type ImportStrategy = "append" | "replace";

type Locale = "fr" | "en";

type LocalizedText =
  | string
  | {
      fr?: string;
      en?: string;
      [k: string]: string | undefined;
    };

type FlashcardJsonV1 = {
  schema?: string;
  title?: LocalizedText;
  cards?: Array<{ front: LocalizedText; back: LocalizedText }>;
};

type ExportFormat = "tsv" | "json";

function sanitizeCell(v: string) {
  return (v ?? "").replaceAll("\t", " ").trimEnd();
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function getLocalized(input: LocalizedText | undefined, locale: Locale): string {
  if (!input) return "";
  if (typeof input === "string") return input;
  // preferred
  const direct = input[locale];
  if (direct && direct.trim()) return direct;
  // fallback order
  const fr = input.fr;
  const en = input.en;
  if (fr && fr.trim()) return fr;
  if (en && en.trim()) return en;
  // any other key
  for (const v of Object.values(input)) {
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

function parseTsvLike(raw: string) {
  const lines = (raw ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: { front: string; back: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Primary: TAB (Quizlet)
    let parts = line.split("\t");
    if (parts.length < 2) {
      // Fallback: CSV-like (first comma/semicolon)
      const m = line.match(/^(.*?)[,;](.*)$/);
      if (!m) {
        throw new Error(`line_tab_required:${i + 1}`);
      }
      parts = [m[1], m[2]];
    }

    const front = (parts[0] ?? "").trim();
    const back = parts.slice(1).join("\t").trim();
    if (!front || !back) continue;
    rows.push({ front, back });
  }

  return rows;
}

function isProbablyJson(raw: string) {
  const s = (raw ?? "").trim();
  return s.startsWith("{") || s.startsWith("[");
}

function parseFlashcardsJson(raw: string): { titleFr?: string; titleEn?: string; cards: Array<{ fr: { front: string; back: string }; en?: { front: string; back: string } }> } {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("invalid_json");
  }

  // Support two shapes:
  // 1) { schema, title, cards: [{front,back}, ...] }
  // 2) [{front,back}, ...]
  const obj: FlashcardJsonV1 | any[] = parsed;

  const cardsRaw: any[] = Array.isArray(obj) ? obj : Array.isArray((obj as any)?.cards) ? (obj as any).cards : [];

  if (!cardsRaw.length) throw new Error("no_valid_rows");

  const titleFr = Array.isArray(obj) ? undefined : getLocalized((obj as any).title, "fr");
  const titleEn = Array.isArray(obj) ? undefined : getLocalized((obj as any).title, "en");

  const cards = cardsRaw
    .map((c: any) => {
      const frontFr = getLocalized(c?.front, "fr").trim();
      const backFr = getLocalized(c?.back, "fr").trim();
      const frontEn = getLocalized(c?.front, "en").trim();
      const backEn = getLocalized(c?.back, "en").trim();

      if (!frontFr || !backFr) return null;

      const out: { fr: { front: string; back: string }; en?: { front: string; back: string } } = {
        fr: { front: frontFr, back: backFr }
      };

      // only attach EN if provided (avoid duplicating FR)
      const hasEn = Boolean(frontEn || backEn) && (frontEn !== frontFr || backEn !== backFr);
      if (hasEn) out.en = { front: frontEn || frontFr, back: backEn || backFr };

      return out;
    })
    .filter(Boolean) as Array<{ fr: { front: string; back: string }; en?: { front: string; back: string } }>;

  if (!cards.length) throw new Error("no_valid_rows");

  return { titleFr: titleFr?.trim() || undefined, titleEn: titleEn?.trim() || undefined, cards };
}

async function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function FlashcardImporterExporter({ setId }: { setId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { t } = useI18n();

  const [mode, setMode] = useState<Mode>("import");
  const [strategy, setStrategy] = useState<ImportStrategy>("append");

  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [exportFormat, setExportFormat] = useState<ExportFormat>("tsv");

  async function exportTsv(): Promise<string> {
    const { data, error } = await supabase
      .from("flashcards")
      .select("front,back,position")
      .eq("set_id", setId)
      .order("position", { ascending: true });

    if (error) throw error;

    return (data ?? [])
      .map((c: any) => `${sanitizeCell(c.front)}\t${sanitizeCell(c.back)}`)
      .join("\n");
  }

  async function exportJson(): Promise<string> {
    // Base FR data
    const { data: cards, error } = await supabase
      .from("flashcards")
      .select("id,front,back,position")
      .eq("set_id", setId)
      .order("position", { ascending: true });
    if (error) throw error;

    const ids = (cards ?? []).map((c: any) => c.id).filter(Boolean);

    // Try to fetch EN translations if table exists. If not, fallback silently.
    const enById = new Map<string, any>();
    try {
      if (ids.length) {
        // avoid query limits by chunking
        for (const batch of chunk(ids, 100)) {
          const { data: trs, error: trErr } = await supabase
            .from("content_translations")
            .select("content_id,payload")
            .eq("content_type", "flashcard")
            .eq("lang", "en")
            .in("content_id", batch);
          if (trErr) throw trErr;
          for (const tr of trs ?? []) {
            enById.set((tr as any).content_id, (tr as any).payload);
          }
        }
      }
    } catch {
      // ignore (not configured / RLS / table missing)
    }

    const out: FlashcardJsonV1 = {
      schema: "cfa-hub.flashcards@1",
      cards: (cards ?? []).map((c: any) => {
        const payload = enById.get(c.id);
        const frontEn = (payload?.front ?? "").toString();
        const backEn = (payload?.back ?? "").toString();
        return {
          front: {
            fr: c.front,
            en: frontEn || undefined
          },
          back: {
            fr: c.back,
            en: backEn || undefined
          }
        };
      })
    };

    return JSON.stringify(out, null, 2);
  }

  async function onCopyExport() {
    setMsg(null);
    setBusy(true);
    try {
      const out = exportFormat === "tsv" ? await exportTsv() : await exportJson();
      await navigator.clipboard.writeText(out);
      setMsg(t("flashcards.exportCopied"));
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setBusy(false);
    }
  }

  async function onDownloadExport() {
    setMsg(null);
    setBusy(true);
    try {
      if (exportFormat === "tsv") {
        const out = await exportTsv();
        await downloadText(`flashcards-${setId}.tsv`, out, "text/tab-separated-values;charset=utf-8");
      } else {
        const out = await exportJson();
        await downloadText(`flashcards-${setId}.json`, out, "application/json;charset=utf-8");
      }
      setMsg(t("flashcards.exportDownloaded"));
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setBusy(false);
    }
  }

  function onPickFile() {
    fileRef.current?.click();
  }

  async function onFileChange() {
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    try {
      const raw = await f.text();
      setText(raw);
      setMode("import");
      setMsg(t("flashcards.fileLoaded"));
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      // allow selecting the same file twice
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onImport() {
    setBusy(true);
    setMsg(null);

    try {
      const raw = text ?? "";
      if (!raw.trim()) throw new Error("empty");

      // Determine starting position for append
      let startPos = 1;
      if (strategy === "append") {
        const { data, error } = await supabase
          .from("flashcards")
          .select("position")
          .eq("set_id", setId)
          .order("position", { ascending: false })
          .limit(1);
        if (error) throw error;
        const maxPos = (data?.[0] as any)?.position;
        startPos = (Number(maxPos) || 0) + 1;
      }

      if (strategy === "replace") {
        const ok = window.confirm(t("flashcards.confirmReplace"));
        if (!ok) {
          setBusy(false);
          return;
        }
        const del = await supabase.from("flashcards").delete().eq("set_id", setId);
        if (del.error) throw del.error;
        startPos = 1;
      }

      // Parse TSV or JSON
      const wantsJson = isProbablyJson(raw);

      if (!wantsJson) {
        // TSV import (FR-only)
        const parsed = parseTsvLike(raw);
        if (parsed.length === 0) throw new Error("no_valid_rows");

        const rows = parsed.map((r, i) => ({
          set_id: setId,
          front: r.front,
          back: r.back,
          position: startPos + i
        }));

        const ins = await supabase.from("flashcards").insert(rows);
        if (ins.error) throw ins.error;

        setText("");
        setMsg(t("flashcards.importSuccess", { n: rows.length }));
        router.refresh();
        return;
      }

      // JSON import (FR base + optional EN translations)
      const json = parseFlashcardsJson(raw);
      const cards = json.cards;

      const rows = cards.map((c, i) => ({
        set_id: setId,
        front: c.fr.front,
        back: c.fr.back,
        position: startPos + i
      }));

      const { data: inserted, error: insErr } = await supabase
        .from("flashcards")
        .insert(rows)
        .select("id,position")
        .order("position", { ascending: true });

      if (insErr) throw insErr;

      const insertedSorted = (inserted ?? []).slice().sort((a: any, b: any) => Number(a.position) - Number(b.position));

      // EN translation upserts (do not block import if they fail)
      const enJobs: Promise<void>[] = [];

      // Set title translation (optional)
      if (json.titleEn && json.titleEn.trim()) {
        enJobs.push(
          (async () => {
            const { error } = await supabase.rpc("upsert_content_translation", {
              p_content_type: "flashcard_set",
              p_content_id: setId,
              p_lang: "en",
              p_payload: { title: json.titleEn }
            });
            if (error) console.warn("[i18n] EN flashcard_set translation failed:", error.message);
          })()
        );
      }

      // Cards translations
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const row = insertedSorted[i] as any;
        const cid = row?.id as string | undefined;
        if (!cid) continue;

        const en = card.en;
        if (!en) continue;

        const frontEn = (en.front ?? "").trim();
        const backEn = (en.back ?? "").trim();
        const hasEn = Boolean(frontEn || backEn);
        if (!hasEn) continue;

        enJobs.push(
          (async () => {
            const { error } = await supabase.rpc("upsert_content_translation", {
              p_content_type: "flashcard",
              p_content_id: cid,
              p_lang: "en",
              p_payload: { front: frontEn, back: backEn }
            });
            if (error) console.warn("[i18n] EN flashcard translation failed:", error.message);
          })()
        );
      }

      // Fire and forget but awaited so users get consistent state if translations succeed.
      if (enJobs.length) {
        await Promise.all(enJobs);
      }

      setText("");
      setMsg(t("flashcards.importSuccess", { n: rows.length }));
      router.refresh();
    } catch (e: any) {
      const m = String(e?.message ?? "");
      if (m === "empty") setMsg(`❌ ${t("flashcards.importErrorEmpty")}`);
      else if (m === "invalid_json") setMsg(`❌ ${t("flashcards.importErrorInvalidJson")}`);
      else if (m === "no_valid_rows") setMsg(`❌ ${t("flashcards.importErrorNoValid")}`);
      else if (m.startsWith("line_tab_required:")) {
        const line = m.split(":")[1] || "?";
        setMsg(`❌ ${t("flashcards.importErrorLineTab", { line })}`);
      } else setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full min-w-0 max-w-full rounded-2xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{t("flashcards.importing")}</h3>
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm border border-white/10 ${
              mode === "import" ? "bg-white text-black" : "bg-neutral-900/60 hover:bg-white/5"
            }`}
            onClick={() => setMode("import")}
          >
            {t("flashcards.import")}
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm border border-white/10 ${
              mode === "export" ? "bg-white text-black" : "bg-neutral-900/60 hover:bg-white/5"
            }`}
            onClick={() => setMode("export")}
          >
            {t("flashcards.export")}
          </button>
        </div>
      </div>

      <p className="mt-1 text-sm opacity-80 break-words [overflow-wrap:anywhere]">{t("flashcards.subtitle")}</p>

      <input ref={fileRef} type="file" accept=".tsv,.txt,.csv,.json" className="hidden" onChange={onFileChange} />

      {mode === "export" ? (
        <div className="mt-4 grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs opacity-70">{t("flashcards.exportFormat")}</span>
            <button
              type="button"
              className={`chip ${exportFormat === "tsv" ? "chip-active" : ""}`}
              onClick={() => setExportFormat("tsv")}
              disabled={busy}
            >
              TSV
            </button>
            <button
              type="button"
              className={`chip ${exportFormat === "json" ? "chip-active" : ""}`}
              onClick={() => setExportFormat("json")}
              disabled={busy}
            >
              JSON
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className="btn btn-secondary" onClick={onCopyExport} disabled={busy}>
              {busy ? t("common.loading") : t("flashcards.exportCopy")}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onDownloadExport} disabled={busy}>
              {busy ? t("common.loading") : t("flashcards.exportDownload")}
            </button>
          </div>

          {msg ? <div className="text-sm break-words [overflow-wrap:anywhere]">{msg}</div> : null}
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs opacity-70">{t("flashcards.importStrategy")}</span>
                <button
                  type="button"
                  className={`chip ${strategy === "append" ? "chip-active" : ""}`}
                  onClick={() => setStrategy("append")}
                  disabled={busy}
                >
                  {t("flashcards.importAppend")}
                </button>
                <button
                  type="button"
                  className={`chip ${strategy === "replace" ? "chip-active" : ""}`}
                  onClick={() => setStrategy("replace")}
                  disabled={busy}
                >
                  {t("flashcards.importReplace")}
                </button>
              </div>

              <button type="button" className="btn btn-ghost" onClick={onPickFile} disabled={busy}>
                {t("flashcards.importFromFile")}
              </button>
            </div>

            {strategy === "replace" ? <div className="text-xs text-amber-200/80">{t("flashcards.replaceWarning")}</div> : null}

            <textarea
              className="box-border h-40 w-full min-w-0 max-w-full rounded-xl border bg-transparent p-3 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("flashcards.importPlaceholder")}
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" className="btn btn-primary" onClick={onImport} disabled={busy || !text.trim()}>
                {busy ? t("common.saving") : t("flashcards.import")}
              </button>
              {msg ? <div className="text-sm break-words [overflow-wrap:anywhere]">{msg}</div> : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
