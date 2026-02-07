"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";

type QuizQuestionLite = {
  id: string;
  prompt: string;
  choices: string[];
  explanation: string | null;
};

export function AdminTranslationsPanel({
  kind,
  setId,
  baseTitle,
  questions
}: {
  kind: "quiz" | "exercise";
  setId: string;
  baseTitle: string;
  questions?: QuizQuestionLite[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const { t, locale } = useI18n();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"import" | "export">("import");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  function buildExample() {
    if (kind === "exercise") {
      return JSON.stringify(
        {
          lang: "en",
          set: {
            title: "(EN) " + baseTitle
          }
        },
        null,
        2
      );
    }

    return JSON.stringify(
      {
        lang: "en",
        set: {
          title: "(EN) " + baseTitle
        },
        questions: (questions ?? []).map((q) => ({
          id: q.id,
          prompt: "(EN) " + q.prompt,
          choices: q.choices,
          explanation: q.explanation
        }))
      },
      null,
      2
    );
  }

  async function copyExample() {
    try {
      await navigator.clipboard.writeText(buildExample());
      setMsg(locale === "fr" ? "✅ Exemple copié" : "✅ Example copied");
    } catch {
      setMsg(locale === "fr" ? "Impossible de copier." : "Could not copy.");
    }
  }

  async function exportJson() {
    setBusy(true);
    setMsg(null);
    try {
      const payload: any = { lang: "en", set: { title: "" } };

      const { data: setTr } = await supabase
        .from("content_translations")
        .select("payload")
        .eq("content_type", kind === "quiz" ? "quiz_set" : "exercise_set")
        .eq("content_id", setId)
        .eq("lang", "en")
        .maybeSingle();
      payload.set.title = (setTr as any)?.payload?.title ?? "";

      if (kind === "quiz") {
        const ids = (questions ?? []).map((q) => q.id);
        const { data: qTr } = ids.length
          ? await supabase
              .from("content_translations")
              .select("content_id,payload")
              .eq("content_type", "quiz_question")
              .eq("lang", "en")
              .in("content_id", ids)
          : { data: [] as any[] };
        const byId = new Map<string, any>();
        (qTr ?? []).forEach((r: any) => byId.set(String(r.content_id), r.payload));
        payload.questions = (questions ?? []).map((q) => {
          const tr = byId.get(q.id);
          return {
            id: q.id,
            prompt: tr?.prompt ?? "",
            choices: tr?.choices ?? [],
            explanation: tr?.explanation ?? null
          };
        });
      }

      const out = JSON.stringify(payload, null, 2);
      setText(out);
      setMode("export");
      setOpen(true);

      try {
        await navigator.clipboard.writeText(out);
        setMsg(locale === "fr" ? "✅ JSON copié" : "✅ JSON copied");
      } catch {
        // ignore
      }
    } catch (e: any) {
      setMsg(e?.message ? String(e.message) : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function importJson() {
    setMsg(null);
    setMode("import");
    setText("");
    setOpen(true);
  }

  async function runImport() {
    setBusy(true);
    setMsg(null);
    try {
      const parsed = JSON.parse(text);
      if (!parsed || parsed.lang !== "en") {
        throw new Error(locale === "fr" ? "Le champ lang doit valoir 'en'." : "lang must be 'en'.");
      }

      const setTitle = String(parsed?.set?.title ?? "").trim();
      if (!setTitle) {
        throw new Error(locale === "fr" ? "set.title est requis." : "set.title is required.");
      }

      // upsert set translation
      const setType = kind === "quiz" ? "quiz_set" : "exercise_set";
      const { error: upSetErr } = await supabase
        .from("content_translations")
        .upsert(
          {
            content_type: setType,
            content_id: setId,
            lang: "en",
            payload: { title: setTitle }
          },
          { onConflict: "content_type,content_id,lang" }
        );
      if (upSetErr) throw upSetErr;

      if (kind === "quiz") {
        const qs: any[] = Array.isArray(parsed.questions) ? parsed.questions : [];
        if (qs.length === 0) {
          throw new Error(locale === "fr" ? "questions[] est requis." : "questions[] is required.");
        }

        const rows = qs.map((q) => {
          const id = String(q.id ?? "").trim();
          if (!id) throw new Error(locale === "fr" ? "question.id manquant." : "Missing question.id");
          const prompt = String(q.prompt ?? "").trim();
          const choices = Array.isArray(q.choices) ? q.choices.map((c: unknown) => String(c)) : [];
          const explanation = q.explanation != null ? String(q.explanation) : null;
          if (!prompt) throw new Error(locale === "fr" ? `prompt manquant pour ${id}` : `Missing prompt for ${id}`);
          if (choices.length < 2) throw new Error(locale === "fr" ? `choices insuffisants pour ${id}` : `Not enough choices for ${id}`);
          return {
            content_type: "quiz_question",
            content_id: id,
            lang: "en",
            payload: { prompt, choices, explanation }
          };
        });

        const { error: upQErr } = await supabase
          .from("content_translations")
          .upsert(rows, { onConflict: "content_type,content_id,lang" });
        if (upQErr) throw upQErr;
      }

      setMsg(locale === "fr" ? "✅ Traductions importées" : "✅ Translations imported");
      setOpen(false);
    } catch (e: any) {
      setMsg(e?.message ? String(e.message) : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind}-translations-en.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950/30 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-semibold">{locale === "fr" ? "Traductions (EN)" : "Translations (EN)"}</div>
          <div className="mt-1 text-xs opacity-70">
            {locale === "fr"
              ? "Permet d'afficher ce contenu officiel en anglais (fallback sur la version de base si absent)."
              : "Lets this official content be shown in English (fallback to base if missing)."}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn btn-secondary" onClick={copyExample} disabled={busy}>
            {locale === "fr" ? "Copy example" : "Copy example"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={exportJson} disabled={busy}>
            {locale === "fr" ? "Exporter JSON" : "Export JSON"}
          </button>
          <button type="button" className="btn btn-primary" onClick={importJson} disabled={busy}>
            {locale === "fr" ? "Importer JSON" : "Import JSON"}
          </button>
        </div>
      </div>

      {msg ? <div className="mt-3 text-sm break-words [overflow-wrap:anywhere]">{msg}</div> : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-neutral-950 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold">
                {mode === "import" ? (locale === "fr" ? "Importer traductions" : "Import translations") : (locale === "fr" ? "Exporter traductions" : "Export translations")}
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
                ✕
              </button>
            </div>

            <textarea
              className="mt-3 box-border w-full min-w-0 max-w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm"
              rows={16}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={mode === "import" ? (locale === "fr" ? "Colle le JSON ici…" : "Paste JSON here…") : ""}
            />

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs opacity-70">
                {mode === "import"
                  ? (locale === "fr" ? "L’import met à jour la traduction anglaise." : "Import updates the EN translation.")
                  : (locale === "fr" ? "Le JSON est prêt (et normalement copié)." : "JSON is ready (and likely copied).")}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                {mode === "export" ? (
                  <button type="button" className="btn btn-secondary" onClick={download} disabled={busy}>
                    {locale === "fr" ? "Télécharger .json" : "Download .json"}
                  </button>
                ) : null}

                {mode === "import" ? (
                  <button type="button" className="btn btn-primary" onClick={runImport} disabled={busy || !text.trim()}>
                    {busy ? t("common.saving") : (locale === "fr" ? "Importer" : "Import")}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
