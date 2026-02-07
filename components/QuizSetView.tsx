"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";
import { ImageInsertButton } from "@/components/ImageInsertButton";
import { RichContent } from "@/components/RichContent";

function appendTag(prev: string, tag: string) {
  const p = (prev ?? "").toString();
  if (!p.trim()) return tag;
  const endsWithNl = p.endsWith("\n");
  return p + (endsWithNl ? "" : "\n") + tag;
}

function previewText(v: string) {
  const s = (v ?? "").toString();
  const first = s.split("\n").find((l) => !!l.trim() && !l.trim().match(/^\[\[img:(.+)\]\]$/i)) ?? "";
  return first.length > 80 ? first.slice(0, 77) + "…" : first;
}

type Question = {
  id: string;
  prompt: string;
  choices: string[];
  correct_index: number; // 0-based
  explanation: string | null;
  position: number;
};

export function QuizSetView({
  setId,
  isOwner,
  initialQuestions
}: {
  setId: string;
  isOwner: boolean; // used as "canEdit"
  initialQuestions: Question[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useI18n();

  const canEdit = isOwner;

  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // UX: keep the default flow focused on studying.
  const [viewMode, setViewMode] = useState<"study" | "edit">("study");

  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonMode, setJsonMode] = useState<"import" | "export">("export");
  const [jsonText, setJsonText] = useState("");
  const [jsonBusy, setJsonBusy] = useState(false);

  // --- Add state
  const [questionPrompt, setQuestionPrompt] = useState("");
  const [choicesText, setChoicesText] = useState("");
  const [correct, setCorrect] = useState(1); // 1-based in UI
  const [explanation, setExplanation] = useState("");

  // --- Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editChoicesText, setEditChoicesText] = useState("");
  const [editCorrect, setEditCorrect] = useState(1); // 1-based in UI
  const [editExplanation, setEditExplanation] = useState("");

  // --- Runner state
  const [i, setI] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [score, setScore] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);

  const current = questions[i] ?? null;
  const canRun = questions.length > 0;

  function resetRun() {
    setI(0);
    setSelected(null);
    setShowCorrection(false);
    setScore(0);
    setStartedAt(Date.now());
    setFinished(false);
    setMsg(null);
  }

  async function fetchQuestions(): Promise<Question[]> {
    const { data, error } = await supabase
      .from("quiz_questions")
      .select("id,prompt,choices,correct_index,explanation,position")
      .eq("set_id", setId)
      .order("position", { ascending: true });

    if (error) return questions;

    return (data ?? []).map((q: any) => ({
      ...q,
      choices: Array.isArray(q.choices) ? q.choices : []
    })) as any;
  }

  async function refreshQuestions() {
    const next = await fetchQuestions();
    setQuestions(next);
  }

  function parseChoices(text: string) {
    return text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function addQuestion() {
    setMsg(null);
    setBusy(true);
    try {
      const lines = parseChoices(choicesText);
      if (!questionPrompt.trim()) throw new Error(t("common.error"));
      if (lines.length < 2 || lines.length > 6)
        throw new Error(t("qcm.choicesPlaceholder"));

      const idx0 =
        Math.max(1, Math.min(lines.length, Number(correct) || 1)) - 1;
      const pos = questions.length;

      const ins = await supabase.from("quiz_questions").insert({
        set_id: setId,
        prompt: questionPrompt.trim(),
        choices: lines,
        correct_index: idx0,
        explanation: explanation.trim() ? explanation.trim() : null,
        position: pos
      });

      if (ins.error) throw ins.error;

      setQuestionPrompt("");
      setChoicesText("");
      setCorrect(1);
      setExplanation("");

      await refreshQuestions();
      setMsg("✅");
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(q: Question) {
    setMsg(null);
    setEditingId(q.id);
    setEditPrompt(q.prompt ?? "");
    setEditChoicesText((q.choices ?? []).join("\n"));
    setEditCorrect((q.correct_index ?? 0) + 1); // show 1-based
    setEditExplanation(q.explanation ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditPrompt("");
    setEditChoicesText("");
    setEditCorrect(1);
    setEditExplanation("");
  }

  async function saveEdit() {
    if (!editingId) return;
    setMsg(null);
    setBusy(true);

    try {
      const lines = parseChoices(editChoicesText);
      if (!editPrompt.trim()) throw new Error(t("common.error"));
      if (lines.length < 2 || lines.length > 6)
        throw new Error(t("qcm.choicesPlaceholder"));

      const idx0 =
        Math.max(1, Math.min(lines.length, Number(editCorrect) || 1)) - 1;

      const upd = await supabase
        .from("quiz_questions")
        .update({
          prompt: editPrompt.trim(),
          choices: lines,
          correct_index: idx0,
          explanation: editExplanation.trim() ? editExplanation.trim() : null
        })
        .eq("id", editingId)
        .eq("set_id", setId);

      if (upd.error) throw upd.error;

      await refreshQuestions();
      cancelEdit();
      setMsg("✅");
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setBusy(false);
    }
  }

  async function reindexPositions() {
    const rows = await fetchQuestions();
    // if positions have gaps, normalize them
    const tasks = rows.map((q, idx) => {
      if (q.position === idx) return null;
      return supabase
        .from("quiz_questions")
        .update({ position: idx })
        .eq("id", q.id)
        .eq("set_id", setId);
    });

    const real = tasks.filter(Boolean) as any[];
    if (real.length > 0) {
      const res = await Promise.all(real);
      const err = res.find((r) => r?.error)?.error;
      if (err) throw err;
    }
  }

  async function deleteQuestion(id: string) {
    const ok = window.confirm("Supprimer cette question ? ( reliably )");
    if (!ok) return;

    setMsg(null);
    setBusy(true);

    try {
      const del = await supabase
        .from("quiz_questions")
        .delete()
        .eq("id", id)
        .eq("set_id", setId);
      if (del.error) throw del.error;

      await reindexPositions();
      await refreshQuestions();

      // keep runner safe
      setI(0);
      setSelected(null);
      setShowCorrection(false);
      setFinished(false);
      setScore(0);

      setMsg("✅");
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setBusy(false);
    }
  }

  function getExampleJson() {
    const payload = {
      version: 1,
      kind: "quiz_set",
      title: "Mon QCM",
      questions: [
        {
          prompt: "Question 1 (texte)",
          choices: ["Choix A", "Choix B", "Choix C"],
          // 1-based index for humans (1 = premier choix)
          correct: 2,
          explanation: "Optionnel"
        },
        {
          prompt: "Question 2 (texte)",
          choices: ["Vrai", "Faux"],
          correct: 1
        }
      ]
    };
    return JSON.stringify(payload, null, 2);
  }

  function normalizeChoices(value: any): string[] {
    if (Array.isArray(value)) return value.map((x) => String(x));
    const s = String(value ?? "").trim();
    if (!s) return [];
    return s
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  }

  async function exportJson() {
    setMsg(null);
    setJsonBusy(true);
    try {
      // Export latest DB state (not just local state)
      const { data, error } = await supabase
        .from("quiz_questions")
        .select("prompt,choices,correct_index,explanation,created_at")
        .eq("set_id", setId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const rows = (data ?? []) as any[];

      const payload = {
        version: 1,
        kind: "quiz_set",
        set_id: setId,
        exported_at: new Date().toISOString(),
        questions: rows.map((q) => {
          const ci = Number(q.correct_index ?? 0) || 0;
          return {
            prompt: String(q.prompt ?? ""),
            choices: Array.isArray(q.choices) ? q.choices : [],
            correct_index: ci,
            correct: ci + 1,
            explanation: q.explanation ? String(q.explanation) : ""
          };
        })
      };

      const str = JSON.stringify(payload, null, 2);
      setJsonText(str);
      setJsonMode("export");
      setJsonOpen(true);

      try {
        await navigator.clipboard.writeText(str);
        setMsg("✅ JSON copié.");
      } catch {
        setMsg("ℹ️ Copie non autorisée par le navigateur. JSON affiché dans la fenêtre.");
      }
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setJsonBusy(false);
    }
  }

  async function downloadJson() {
    try {
      const str = jsonText || (function () { return ""; })();
      const blob = new Blob([str], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quiz-${setId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    }
  }

  async function runImport(raw: string) {
    setJsonBusy(true);
    setMsg(null);

    try {
      const obj = JSON.parse(raw);
      const arr = Array.isArray((obj as any)?.questions) ? (obj as any).questions : null;
      if (!arr || arr.length === 0) throw new Error("Format invalide: questions[] manquant ou vide.");

      const rows = arr
        .map((q: any, k: number) => {
          const prompt = String(q?.prompt ?? q?.question ?? "").trim();
          const choices = normalizeChoices(q?.choices ?? q?.options ?? q?.answers ?? "");
          const ci0 = q?.correct_index;
          const ci1 = q?.correct;

          let correctIndex = 0;
          if (typeof ci0 !== "undefined" && ci0 !== null && String(ci0).trim() !== "") {
            correctIndex = Number(ci0) || 0;
          } else if (typeof ci1 !== "undefined" && ci1 !== null && String(ci1).trim() !== "") {
            correctIndex = (Number(ci1) || 1) - 1;
          }

          // Clamp
          if (correctIndex < 0) correctIndex = 0;
          if (choices.length > 0 && correctIndex >= choices.length) correctIndex = choices.length - 1;

          if (!prompt) return null;
          if (choices.length < 2) return null;

          return {
            set_id: setId,
            prompt,
            choices: choices.slice(0, 6),
            correct_index: correctIndex,
            explanation: q?.explanation ? String(q.explanation) : null,
            position: k
          };
        })
        .filter(Boolean) as any[];

      if (rows.length === 0) throw new Error("Aucune question valide après validation (min 2 choix).");

      // Replace existing questions
      const del = await supabase.from("quiz_questions").delete().eq("set_id", setId);
      if (del.error) throw del.error;

      const ins = await supabase.from("quiz_questions").insert(rows);
      if (ins.error) throw ins.error;

      await refreshQuestions();
      setI(0);
      setSelected(null);
      setShowCorrection(false);
      setFinished(false);
      setScore(0);

      setJsonOpen(false);
      setJsonText("");
      setMsg("✅ Import terminé.");
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setJsonBusy(false);
    }
  }

  async function importJson() {
    setMsg(null);
    setJsonMode("import");
    setJsonText("");
    setJsonOpen(true);
  }

  async function copyExampleJson() {
    const ex = getExampleJson();
    try {
      await navigator.clipboard.writeText(ex);
      setMsg("✅ Exemple JSON copié.");
    } catch {
      // fallback: open export modal with the example
      setJsonText(ex);
      setJsonMode("export");
      setJsonOpen(true);
      setMsg("ℹ️ Copie non autorisée. Exemple affiché dans la fenêtre.");
    }
  }

  // Used inside the import modal: helps the user by both inserting the example and copying it.
  async function insertExampleJson() {
    const ex = getExampleJson();
    setJsonText(ex);
    try {
      await navigator.clipboard.writeText(ex);
      setMsg("✅ Exemple JSON copié.");
    } catch {
      // Clipboard may be blocked; the textarea still contains the example.
      setMsg("ℹ️ Copie non autorisée. Exemple inséré dans le champ.");
    }
  }

  async function submitAttempt(finalScore: number) {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const duration = startedAt
        ? Math.round((Date.now() - startedAt) / 1000)
        : null;
      await supabase.from("quiz_attempts").insert({
        user_id: auth.user.id,
        set_id: setId,
        score: finalScore,
        total: questions.length,
        duration_seconds: duration
      });
    } catch {
      // ignore
    }
  }

  async function awardXpForAnswer(questionId: string, selectedIndex: number) {
    try {
      const { data, error } = await supabase.rpc("award_quiz_question_xp", {
        p_question_id: questionId,
        p_selected_index: selectedIndex
      });

      if (error) {
        setMsg(`❌ XP error: ${error.message}`);
        return;
      }

      // Function returns a single-row table
      const row = Array.isArray(data) ? (data[0] as any) : (data as any);
      const xp = Number(row?.xp_awarded ?? 0) || 0;

      if (xp > 0) setMsg(`✅ +${xp} XP`);
      else setMsg("ℹ️ Pas d'XP (déjà validée ou non-officiel)");
    } catch (e: any) {
      setMsg(`❌ XP exception: ${e?.message ?? "unknown"}`);
    }
  }

  return (
    <div className="grid gap-4 min-w-0 max-w-full overflow-x-hidden">
      {/* Import / Export modal */}
      {jsonOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-neutral-950 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold">{jsonMode === "import" ? "Importer JSON" : "Exporter JSON"}</div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setJsonOpen(false)}
                disabled={jsonBusy}
              >
                ✕
              </button>
            </div>

            {jsonMode === "import" ? (
              <div className="mt-3 text-xs opacity-70">
                Colle ton JSON ici. Besoin d’un exemple ? Clique sur &quot;{t("qcm.copyExample")}&quot;.
              </div>
            ) : (
              <div className="mt-3 text-xs opacity-70">
                Le JSON est prêt (et normalement copié). Tu peux aussi le télécharger.
              </div>
            )}

            <textarea
              className="mt-3 box-border w-full min-w-0 max-w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm"
              rows={16}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder={jsonMode === "import" ? "Colle le JSON ici…" : ""}
            />

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs opacity-70">
                {jsonMode === "import"
                  ? "L’import remplace toutes les questions existantes."
                  : "Astuce: tu peux coller ce JSON dans ChatGPT pour générer des questions compatibles."}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                {jsonMode === "import" ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={insertExampleJson}
                    disabled={jsonBusy}
                  >
                    {t("qcm.copyExample")}
                  </button>
                ) : null}

                {jsonMode === "export" ? (
                  <button type="button" className="btn btn-secondary" onClick={downloadJson} disabled={jsonBusy}>
                    Télécharger .json
                  </button>
                ) : null}

                {jsonMode === "import" ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => runImport(jsonText)}
                    disabled={jsonBusy || !jsonText.trim()}
                  >
                    {jsonBusy ? t("common.saving") : "Importer"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Tabs (study first) */}
      {canEdit ? (
        <div className="rounded-2xl border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs opacity-70">{msg ?? ""}</div>
            <div className="flex gap-2">
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-sm border border-white/10 ${
                  viewMode === "study" ? "bg-white text-black" : "bg-neutral-900/60 hover:bg-white/5"
                }`}
                onClick={() => setViewMode("study")}
              >
                Study
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-sm border border-white/10 ${
                  viewMode === "edit" ? "bg-white text-black" : "bg-neutral-900/60 hover:bg-white/5"
                }`}
                onClick={() => setViewMode("edit")}
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      ) : msg ? (
        <div className="text-sm break-words [overflow-wrap:anywhere]">{msg}</div>
      ) : null}

      {/* Edit tools (hidden by default) */}
      {canEdit && viewMode === "edit" ? (
        <>
          <div className="rounded-2xl border p-4">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold">{t("qcm.importExport")}</div>
                <div className="text-xs opacity-70">JSON (copie/coller) — pratique pour partager rapidement.</div>
              </div>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="w-full sm:w-auto rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
                  onClick={exportJson}
                  disabled={jsonBusy}
                >
                  {jsonBusy ? t("common.saving") : t("qcm.exportJson")}
                </button>
                <button
                  type="button"
                  className="w-full sm:w-auto rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
                  onClick={importJson}
                  disabled={jsonBusy}
                >
                  {t("qcm.importJson")}
                </button>
                <button
                  type="button"
                  className="w-full sm:w-auto rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
                  onClick={copyExampleJson}
                  disabled={jsonBusy}
                >
                  {t("qcm.copyExample")}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
              <h2 className="font-semibold">{t("qcm.addQuestionTitle")}</h2>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="grid gap-2">
                <textarea
                  className="box-border w-full min-w-0 max-w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm"
                  rows={3}
                  value={questionPrompt}
                  onChange={(e) => setQuestionPrompt(e.target.value)}
                  placeholder={t("qcm.promptPlaceholder")}
                />
                <div className="flex items-center justify-end">
                  <ImageInsertButton onInsert={(tag) => setQuestionPrompt((p) => appendTag(p, tag))} />
                </div>
              </div>

              <div className="grid gap-2">
                <textarea
                  className="box-border w-full min-w-0 max-w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm"
                  rows={4}
                  value={choicesText}
                  onChange={(e) => setChoicesText(e.target.value)}
                  placeholder={t("qcm.choicesPlaceholder")}
                />
                <div className="flex items-center justify-end">
                  <ImageInsertButton onInsert={(tag) => setChoicesText((p) => appendTag(p, tag))} />
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="text-sm opacity-80">{t("qcm.correctIndexLabel")}</label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  className="box-border w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm sm:w-24"
                  value={correct}
                  onChange={(e) => setCorrect(Number(e.target.value))}
                />
              </div>

              <div className="grid gap-2">
                <input
                  className="box-border w-full min-w-0 max-w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder={t("qcm.explanationPlaceholder")}
                />
                <div className="flex items-center justify-end">
                  <ImageInsertButton onInsert={(tag) => setExplanation((p) => appendTag(p, tag))} />
                </div>
              </div>

              <button
                type="button"
                className="box-border w-full rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50 sm:w-auto"
                disabled={busy}
                onClick={addQuestion}
              >
                {busy ? t("common.saving") : t("qcm.addQuestion")}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="font-semibold">Gestion des questions</div>
            <div className="mt-1 text-xs opacity-70">Modifier / supprimer (autorisé si owner ou membre du groupe).</div>

            <div className="mt-4 grid gap-2">
              {questions.length === 0 ? (
                <div className="text-sm opacity-70">{t("qcm.noQuestions")}</div>
              ) : (
                questions.map((q, idx) => {
                  const isEditing = editingId === q.id;
                  return (
                    <div key={q.id} className="rounded-xl border border-white/10 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium break-words sm:truncate">
                            Q{idx + 1}. {previewText(q.prompt)}
                          </div>
                          <div className="mt-1 text-xs opacity-70">
                            {q.choices.length} choix • bonne réponse #{(q.correct_index ?? 0) + 1}
                          </div>
                        </div>

                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
                          {!isEditing ? (
                            <button
                              type="button"
                              className="box-border w-full rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm hover:bg-white/5 sm:w-auto"
                              onClick={() => startEdit(q)}
                            >
                              Modifier
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="box-border w-full rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm hover:bg-white/5 sm:w-auto"
                              onClick={cancelEdit}
                            >
                              Annuler
                            </button>
                          )}

                          <button
                            type="button"
                            className="box-border w-full rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 hover:bg-red-500/20 sm:w-auto"
                            disabled={busy}
                            onClick={() => deleteQuestion(q.id)}
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>

                      {isEditing && (
                        <div className="mt-3 grid gap-2">
                          <textarea
                            className="box-border w-full min-w-0 max-w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm"
                            rows={3}
                            value={editPrompt}
                            onChange={(e) => setEditPrompt(e.target.value)}
                          />

                          <div className="flex items-center justify-end">
                            <ImageInsertButton onInsert={(tag) => setEditPrompt((p) => appendTag(p, tag))} />
                          </div>

                          <textarea
                            className="box-border w-full min-w-0 max-w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm"
                            rows={4}
                            value={editChoicesText}
                            onChange={(e) => setEditChoicesText(e.target.value)}
                          />

                          <div className="flex items-center justify-end">
                            <ImageInsertButton onInsert={(tag) => setEditChoicesText((p) => appendTag(p, tag))} />
                          </div>

                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <label className="text-sm opacity-80">Bonne réponse (1 = 1ère ligne)</label>
                            <input
                              type="number"
                              min={1}
                              max={6}
                              className="box-border w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm sm:w-24"
                              value={editCorrect}
                              onChange={(e) => setEditCorrect(Number(e.target.value))}
                            />
                          </div>

                          <div className="grid gap-2">
                            <input
                              className="box-border w-full min-w-0 max-w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm"
                              value={editExplanation}
                              onChange={(e) => setEditExplanation(e.target.value)}
                              placeholder={t("qcm.explanationPlaceholder")}
                            />
                            <div className="flex items-center justify-end">
                              <ImageInsertButton onInsert={(tag) => setEditExplanation((p) => appendTag(p, tag))} />
                            </div>
                          </div>

                          <button
                            type="button"
                            className="box-border w-full rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50 sm:w-auto"
                            disabled={busy}
                            onClick={saveEdit}
                          >
                            {busy ? t("common.saving") : "Enregistrer"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : null}

      {/* Runner (always visible) */}
      <div className="rounded-2xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-semibold">{t("qcm.title")}</div>
            <div className="text-xs opacity-70">{questions.length} question(s)</div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              className="box-border w-full rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50 sm:w-auto"
              disabled={!canRun}
              onClick={() => resetRun()}
            >
              {t("qcm.start")}
            </button>
          </div>
        </div>

        {/* Show messages also during the run */}
        {msg && (
          <div className="mt-3 text-sm break-words [overflow-wrap:anywhere]">
            {msg}
          </div>
        )}

        {!canRun && <div className="mt-4 text-sm opacity-70">{t("qcm.noQuestions")}</div>}

        {canRun && current && !finished && (
          <div className="mt-4">
            <div className="text-xs opacity-70">
              {i + 1}/{questions.length}
            </div>
            <div className="mt-2 text-base font-medium">
              <RichContent text={current.prompt} />
            </div>

            <div className="mt-4 grid gap-2">
              {current.choices.map((c, idx) => {
                const picked = selected === idx;
                const correctIdx = current.correct_index;
                const isCorrect = idx === correctIdx;
                const show = showCorrection;
                const baseBtn =
                  "w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40";
                const state =
                  show
                    ? picked
                      ? isCorrect
                        ? "border-green-500/40 bg-green-500/15"
                        : "border-red-500/40 bg-red-500/15"
                      : isCorrect
                        ? "border-green-500/25 bg-green-500/10"
                        : "border-white/10 bg-neutral-900/40 hover:bg-white/5"
                    : picked
                      ? "border-blue-500/40 bg-blue-500/10"
                      : "border-white/10 bg-neutral-900/40 hover:bg-white/5";

                return (
                  <button
                    key={idx}
                    type="button"
                    aria-pressed={picked}
                    className={`${baseBtn} ${state}`}
                    onClick={() => {
                      if (showCorrection) return;
                      setSelected(idx);
                    }}
                  >
                    <div className="opacity-90 break-words [overflow-wrap:anywhere]">
                      <RichContent text={c} />
                    </div>
                  </button>
                );
              })}
            </div>

            {showCorrection && (current.explanation || current.correct_index != null) && (
              <div className="mt-4 rounded-xl border border-white/10 bg-neutral-900/40 p-4 text-sm">
                <div className="font-semibold">Correction</div>
                <div className="mt-2 opacity-90">
                  ✅ <RichContent text={current.choices[current.correct_index]} />
                </div>
                {current.explanation && (
                  <div className="mt-2 opacity-80">
                    <RichContent text={current.explanation} />
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm opacity-70">
                {t("qcm.score")}: {score}
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                {!showCorrection ? (
                  <button
                    type="button"
                    className="box-border w-full rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50 sm:w-auto"
                    disabled={selected == null}
                    onClick={() => {
                      if (selected == null) return;
                      const correctIdx = current.correct_index;

                      // award XP only when the answer is correct
                      if (selected === correctIdx) {
                        setScore((s) => s + 1);
                        void awardXpForAnswer(current.id, selected);
                      } else {
                        setMsg("❌ Mauvaise réponse (pas d'XP)");
                      }

                      setShowCorrection(true);
                    }}
                  >
                    Valider
                  </button>
                ) : i < questions.length - 1 ? (
                  <button
                    type="button"
                    className="rounded-lg border border-white/10 bg-neutral-900/60 px-4 py-2 text-sm hover:bg-white/5"
                    onClick={() => {
                      setI((v) => v + 1);
                      setSelected(null);
                      setShowCorrection(false);
                    }}
                  >
                    {t("qcm.next")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="rounded-lg border border-white/10 bg-neutral-900/60 px-4 py-2 text-sm hover:bg-white/5"
                    onClick={async () => {
                      setFinished(true);
                      await submitAttempt(score);
                    }}
                  >
                    {t("qcm.finish")}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {finished && (
          <div className="mt-4 rounded-xl border border-white/10 bg-neutral-900/40 p-4">
            <div className="text-sm opacity-70">{t("qcm.score")}</div>
            <div className="mt-1 text-2xl font-semibold">
              {score}/{questions.length}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="rounded-lg border border-white/10 bg-neutral-900/60 px-4 py-2 text-sm hover:bg-white/5"
                onClick={resetRun}
              >
                Recommencer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

}
