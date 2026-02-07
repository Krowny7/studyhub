"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { useLocale } from "@/lib/useLocale";
import { t } from "@/lib/i18n/core";

function isRpcMissingFunction(err: any) {
  const msg = String(err?.message ?? "").toLowerCase();
  return (
    msg.includes("could not find the function") ||
    msg.includes("function public.") ||
    msg.includes("schema cache") ||
    msg.includes("pgrst202")
  );
}

type Challenge = {
  id: string;
  status: string;
  created_by: string;
  opponent_id: string;
  quiz_set_id: string;
  expires_at: string;
  rated: boolean;
  winner_id: string | null;
};

type Attempt = {
  user_id: string;
  score: number;
  total: number;
  duration_seconds: number;
  submitted_at: string;
};

type Question = {
  id: string;
  prompt: string;
  choices: string[];
  correct_index: number | null;
  explanation: string | null;
};

function fmtTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${String(r).padStart(2, "0")}s` : `${r}s`;
}

export function PvpChallengeView({
  meId,
  challenge,
  quizTitle,
  challengerName,
  opponentName,
  initialAttempts,
  questions,
  ratingEvent,
  elos
}: {
  meId: string;
  challenge: Challenge;
  quizTitle: string;
  challengerName: string;
  opponentName: string;
  initialAttempts: Attempt[];
  questions: Question[];
	ratingEvent?: {
		challenge_id: string;
		challenger_id: string;
		opponent_id: string;
		challenger_delta: number | null;
		opponent_delta: number | null;
		challenger_after: number | null;
		opponent_after: number | null;
	} | null;
	elos?: { [userId: string]: number | null };
}) {
  const supabase = useMemo(() => createClient(), []);
  const locale = useLocale();
  const router = useRouter();

  const [status, setStatus] = useState(challenge.status);
  const [attempts, setAttempts] = useState<Attempt[]>(initialAttempts);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Runner state
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [i, setI] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const isCreator = meId === challenge.created_by;
  const isOpponent = meId === challenge.opponent_id;

  const myAttempt = attempts.find((a) => a.user_id === meId) ?? null;
  const otherId = isCreator ? challenge.opponent_id : challenge.created_by;
  const otherAttempt = attempts.find((a) => a.user_id === otherId) ?? null;

  const canAccept = status === "pending" && isOpponent;
  const canPlay = status === "accepted" && !myAttempt;

  const current = questions[i] ?? null;

  async function refresh() {
    setBusy(true);
    setMsg(null);
    try {
      const { data: ch } = await supabase
        .from("pvp_challenges")
        .select("id,status,created_by,opponent_id,quiz_set_id,expires_at,rated,winner_id")
        .eq("id", challenge.id)
        .maybeSingle();
      if (ch) setStatus(String((ch as any).status));

      const { data: at } = await supabase
        .from("pvp_attempts")
        .select("user_id,score,total,duration_seconds,submitted_at")
        .eq("challenge_id", challenge.id);
      setAttempts((at ?? []) as any);

      router.refresh();
    } catch (e: any) {
      setMsg(e?.message ? String(e.message) : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    // If I already submitted and opponent not yet, poll lightly.
    if (!myAttempt || otherAttempt || status !== "accepted") return;
    const handle = setInterval(() => {
      void refresh();
    }, 3500);
    return () => clearInterval(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, myAttempt?.submitted_at, otherAttempt?.submitted_at]);

  async function accept() {
    setBusy(true);
    setMsg(null);
    try {
      // PostgREST RPC requires JSON keys to match the function argument names.
      // We prefer the `p_`-prefixed convention, but we retry with legacy keys
      // to avoid hard failures if the database has not been migrated yet.
      let rpc = await supabase.rpc("pvp_accept_challenge", { p_challenge_id: challenge.id });
      if (rpc.error) {
        const m = String(rpc.error.message || "");
        if (m.includes("schema cache") || m.includes("Could not find the function")) {
          rpc = await supabase.rpc("pvp_accept_challenge", { challenge_id: challenge.id } as any);
        }
      }
      if (rpc.error) throw rpc.error;
      setStatus("accepted");
      await refresh();
    } catch (e: any) {
      setMsg(e?.message ? String(e.message) : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  function startRun() {
    setMsg(null);
    setStartedAt(Date.now());
    setI(0);
    setSelected(null);
    setShowCorrection(false);
    setScore(0);
    setFinished(false);
  }

  async function submitRun() {
    if (!startedAt) return;
    setBusy(true);
    setMsg(null);
    try {
      const duration = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      // PostgREST RPC requires JSON keys to match the function argument names.
      // We standardize on the `p_`-prefixed RPC arguments, but we also retry with legacy keys
      // to avoid hard failures if the database functions haven't been migrated yet.
      let rpc = await supabase.rpc("pvp_submit_attempt", {
        p_challenge_id: challenge.id,
        p_score: score,
        p_total: questions.length,
        p_duration_seconds: duration,
      });

      if (rpc.error && isRpcMissingFunction(rpc.error)) {
        rpc = await supabase.rpc("pvp_submit_attempt", {
          challenge_id: challenge.id,
          score,
          total: questions.length,
          duration_seconds: duration,
        });
      }

      if (rpc.error) throw rpc.error;
      const resultRow = Array.isArray(rpc.data) ? (rpc.data[0] as any) : (rpc.data as any);

      // We always show my score immediately; opponent is shown only once they submit.
      setFinished(true);

      // If the duel is completed, we keep the user on the page (better feedback),
      // but we refresh so the scoreboard/elo updates are visible.
      if (resultRow?.status === "completed") {
        setMsg(t(locale, "pvp.duelCompleted"));
      } else {
        setMsg(t(locale, "pvp.attemptSubmitted"));
      }
      await refresh();
    } catch (e: any) {
      setMsg(e?.message ? String(e.message) : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  // Result helper
  function resultLabel() {
    if (status !== "completed") return null;
    if (!myAttempt || !otherAttempt) return null;

    if (myAttempt.score > otherAttempt.score) return t(locale, "pvp.youWin");
    if (myAttempt.score < otherAttempt.score) return t(locale, "pvp.youLose");

    if (myAttempt.duration_seconds < otherAttempt.duration_seconds) return t(locale, "pvp.youWin");
    if (myAttempt.duration_seconds > otherAttempt.duration_seconds) return t(locale, "pvp.youLose");

    return t(locale, "pvp.draw");
  }

  const isRated = challenge.rated === true;

  function eloDisplay(userId: string) {
    const base = elos?.[userId] ?? null;
    if (!ratingEvent) {
      return base == null ? null : { elo: base, delta: null, rated: false };
    }

    const isChallenger = userId === ratingEvent.challenger_id;
    const after = isChallenger ? ratingEvent.challenger_after : ratingEvent.opponent_after;
    const delta = isChallenger ? ratingEvent.challenger_delta : ratingEvent.opponent_delta;

    const elo = (after ?? base) ?? null;
    // In draw we store null deltas; we want to show 0.
    const safeDelta = (delta ?? 0);
    return elo == null ? null : { elo, delta: safeDelta, rated: true };
  }

  return (
    <div className="grid gap-4">
      <div className="card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm opacity-70">{t(locale, "pvp.title")}</div>
            <div className="mt-1 text-2xl font-semibold break-words">{quizTitle}</div>
            <div className="mt-2 text-xs opacity-70">
              {challengerName} vs {opponentName} • {t(locale, `pvp.${status}` as any) ?? status}
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={refresh}
              disabled={busy}
            >
              {t(locale, "pvp.refresh")}
            </button>

            {canAccept ? (
              <button type="button" className="btn btn-primary" onClick={accept} disabled={busy}>
                {t(locale, "pvp.accept")}
              </button>
            ) : null}
          </div>
        </div>

        {msg ? <div className="mt-3 text-sm break-words [overflow-wrap:anywhere]">{msg}</div> : null}
      </div>

      {/* Pre-run status */}
      {status === "pending" ? (
        <div className="card-soft p-6">
          <div className="text-sm opacity-80">
            {isCreator
              ? locale === "fr"
                ? "Invitation envoyée. En attente d’acceptation…"
                : "Invite sent. Waiting for acceptance…"
              : locale === "fr"
                ? "Tu as reçu une invitation." 
                : "You received an invite."}
          </div>
        </div>
      ) : null}

      {/* Play area */}
      {status === "accepted" && canPlay ? (
        <div className="card p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold">{t(locale, "qcm.title")}</div>
              <div className="text-xs opacity-70">{questions.length} question(s)</div>
            </div>

            <button type="button" className="btn btn-primary" onClick={startRun} disabled={busy || questions.length === 0}>
              {t(locale, "pvp.play")}
            </button>
          </div>

          {startedAt && !finished && current ? (
            <div className="mt-5">
              <div className="text-xs opacity-70">
                {i + 1}/{questions.length}
              </div>
              <div className="mt-2 whitespace-pre-wrap text-base font-medium">{current.prompt}</div>

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
                      <div className="opacity-90 break-words [overflow-wrap:anywhere]">{c}</div>
                    </button>
                  );
                })}
              </div>

              {showCorrection && (current.explanation || current.correct_index != null) ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-neutral-900/40 p-4 text-sm">
                  <div className="font-semibold">{locale === "fr" ? "Correction" : "Answer"}</div>
                  {current.correct_index != null ? (
                    <div className="mt-2 opacity-90">✅ {current.choices[current.correct_index]}</div>
                  ) : null}
                  {current.explanation ? (
                    <div className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere] opacity-80">
                      {current.explanation}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm opacity-70">
                  {t(locale, "pvp.yourScore")}: {score}
                </div>

                {!showCorrection ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={selected == null}
                    onClick={() => {
                      if (selected == null) return;
                      if (selected === current.correct_index) setScore((s) => s + 1);
                      setShowCorrection(true);
                    }}
                  >
                    {locale === "fr" ? "Valider" : "Validate"}
                  </button>
                ) : i < questions.length - 1 ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setI((v) => v + 1);
                      setSelected(null);
                      setShowCorrection(false);
                    }}
                  >
                    {t(locale, "qcm.next")}
                  </button>
                ) : (
                  <button type="button" className="btn btn-secondary" onClick={submitRun} disabled={busy}>
                    {t(locale, "qcm.finish")}
                  </button>
                )}
              </div>
            </div>
          ) : startedAt && finished ? (
            <div className="mt-5 text-sm opacity-80">{t(locale, "pvp.waitingOpponent")}</div>
          ) : null}
        </div>
      ) : null}

      {/* After submit (accepted) */}
      {status === "accepted" && myAttempt ? (
        <div className="card-soft p-6">
          <div className="font-semibold">{t(locale, "pvp.yourScore")}</div>
          <div className="mt-2 text-2xl font-semibold">
            {myAttempt.score}/{myAttempt.total}
          </div>
          <div className="mt-1 text-xs opacity-70">
            {locale === "fr" ? "Temps" : "Time"}: {fmtTime(myAttempt.duration_seconds)}
          </div>

          {!otherAttempt ? (
            <div className="mt-3 text-sm opacity-70">{t(locale, "pvp.waitingOpponent")}</div>
          ) : null}
        </div>
      ) : null}

      {/* Completed */}
      {status === "completed" && myAttempt && otherAttempt ? (
        <div className="card p-6">
          <div className="font-semibold">{t(locale, "pvp.duelResult")}</div>
          <div className="mt-2 text-sm">{resultLabel()}</div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-neutral-950/40 p-4">
              <div className="text-xs opacity-70">{challengerName}</div>
              <div className="mt-1 text-xl font-semibold">
                {attempts.find((a) => a.user_id === challenge.created_by)?.score ?? 0}/{questions.length}
              </div>
              <div className="text-xs opacity-70">
                {fmtTime(attempts.find((a) => a.user_id === challenge.created_by)?.duration_seconds ?? 0)}
              </div>

              {(() => {
                const e = eloDisplay(challenge.created_by);
                if (!e || e.elo == null) return null;
                const delta = e.delta;
                const deltaText = typeof delta === "number" ? ` (${delta >= 0 ? "+" : ""}${delta})` : "";
                return (
                  <div className="mt-2 text-[11px] text-white/70">
                    Elo {e.elo}
                    {typeof delta === "number" ? (
                      <span className={delta >= 0 ? "text-emerald-400" : "text-red-400"}>{deltaText}</span>
                    ) : (
                      <span className="opacity-60">{isRated ? " (rated)" : " (not rated)"}</span>
                    )}

                  </div>
                );
              })()}
            </div>

            <div className="rounded-2xl border border-white/10 bg-neutral-950/40 p-4">
              <div className="text-xs opacity-70">{opponentName}</div>
              <div className="mt-1 text-xl font-semibold">
                {attempts.find((a) => a.user_id === challenge.opponent_id)?.score ?? 0}/{questions.length}
              </div>
              <div className="text-xs opacity-70">
                {fmtTime(attempts.find((a) => a.user_id === challenge.opponent_id)?.duration_seconds ?? 0)}
              </div>

              {(() => {
                const e = eloDisplay(challenge.opponent_id);
                if (!e || e.elo == null) return null;
                const delta = e.delta;
                const deltaText = typeof delta === "number" ? ` (${delta >= 0 ? "+" : ""}${delta})` : "";
                return (
                  <div className="mt-2 text-[11px] text-white/70">
                    Elo {e.elo}
                    {typeof delta === "number" ? (
                      <span className={delta >= 0 ? "text-emerald-400" : "text-red-400"}>{deltaText}</span>
                    ) : (
                      <span className="opacity-60">{isRated ? " (rated)" : " (not rated)"}</span>
                    )}

                  </div>
                );
              })()}
            </div>
          </div>

          <div className="mt-4 text-xs opacity-70">
            {locale === "fr"
              ? "Tie-break: si même score, le plus rapide gagne."
              : "Tie-break: if same score, the fastest wins."}
          </div>

          {!ratingEvent ? (
            <div className="mt-1 text-xs text-white/50">
              {locale === "fr"
                ? "Elo non comptabilisé (minimum 5 questions pour un duel classé)."
                : "Elo not counted (minimum 5 questions for a rated duel)."}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
