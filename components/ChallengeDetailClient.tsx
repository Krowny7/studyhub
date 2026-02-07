"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";
import { PvpChallengeView } from "@/components/PvpChallengeView";

type ChallengeRow = {
  id: string;
  status: string;
  created_by: string;
  opponent_id: string;
  quiz_set_id: string;
  expires_at: string;
  rated: boolean;
  winner_id: string | null;
};

type AttemptRow = {
  user_id: string;
  score: number;
  total: number;
  duration_seconds: number;
  submitted_at: string;
};

type RatingEventRow = {
  challenge_id: string;
  challenger_id: string;
  opponent_id: string;
  challenger_delta: number | null;
  opponent_delta: number | null;
  challenger_after: number | null;
  opponent_after: number | null;
  scored_at: string;
};

type QuestionRow = {
  id: string;
  prompt: string;
  choices: string[];
  correct_index: number | null;
  explanation: string | null;
};

type RpcPayload = {
  challenge: ChallengeRow;
  quiz_set: { id: string; title: string };
  questions: QuestionRow[];
};

function isRpcMissingFunction(err: any) {
  const msg = String(err?.message ?? "").toLowerCase();
  return (
    msg.includes("could not find the function") ||
    msg.includes("function public.") && msg.includes("not found") ||
    msg.includes("schema cache") ||
    String(err?.code ?? "").toUpperCase() === "PGRST202"
  );
}

export default function ChallengeDetailClient() {
  const params = useParams<{ id: string }>();
  const challengeId = String((params as any)?.id ?? "");
  const router = useRouter();
  const { locale } = useI18n();

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [challenge, setChallenge] = useState<ChallengeRow | null>(null);
  const [quizTitle, setQuizTitle] = useState<string>("");
  const [challengerName, setChallengerName] = useState<string>("");
  const [opponentName, setOpponentName] = useState<string>("");
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);

  const [ratingEvent, setRatingEvent] = useState<RatingEventRow | null>(null);
  const [elos, setElos] = useState<Record<string, number | null>>({});


  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        if (!challengeId) {
          setError("Missing challenge id");
          return;
        }

        const { data: auth } = await supabase.auth.getUser();
        const user = auth.user;
        if (!user) {
          setMeId(null);
          // Best-effort redirect; still render a message if route doesn't exist.
          try {
            router.push("/login");
          } catch {}
          setError("Please sign in.");
          return;
        }
        setMeId(user.id);

        const { data: ch } = await supabase
          .from("pvp_challenges")
          .select("id,status,created_by,opponent_id,quiz_set_id,expires_at,rated,winner_id")
          .eq("id", challengeId)
          .maybeSingle();

        if (!ch) {
          setError("Challenge not found.");
          return;
        }

        const created_by = String((ch as any).created_by);
        const opponent_id = String((ch as any).opponent_id);
        if (user.id !== created_by && user.id !== opponent_id) {
          setError("Not allowed.");
          return;
        }

        const challengeRow: ChallengeRow = {
          id: String((ch as any).id),
          status: String((ch as any).status),
          created_by,
          opponent_id,
          quiz_set_id: String((ch as any).quiz_set_id),
          expires_at: String((ch as any).expires_at),
          rated: Boolean((ch as any).rated),
          winner_id: (ch as any).winner_id ? String((ch as any).winner_id) : null
        };
        setChallenge(challengeRow);

        // Fetch details via RPC to avoid RLS issues on quiz_sets/questions.
        // But be robust: if the function is missing (common when SQL hasn't been applied yet),
        // fallback to direct selects (same logic as /qcm/[id]).
        const fetchFallback = async (quizSetId: string) => {
          const { data: setRow, error: setErr } = await supabase
            .from("quiz_sets")
            .select("id,title")
            .eq("id", quizSetId)
            .single();
          if (setErr) throw setErr;

          let setTitle = String((setRow as any)?.title ?? "(quiz)");
          if (locale !== "fr") {
            const { data: setTr } = await supabase
              .from("content_translations")
              .select("content")
              .eq("entity_type", "quiz_set")
              .eq("entity_id", quizSetId)
              .eq("lang", locale)
              .maybeSingle();
            if (setTr?.content) setTitle = String(setTr.content);
          }

          const { data: qRows, error: qErr } = await supabase
            .from("quiz_questions")
            .select("id,position,prompt,choices,correct_index,explanation")
            .eq("set_id", quizSetId)
            .order("position", { ascending: true });
          if (qErr) throw qErr;

          let questions: QuestionRow[] = (qRows ?? []).map((q: any) => ({
            id: String(q.id),
            position: Number(q.position ?? 0),
            prompt: String(q.prompt ?? ""),
            choices: (q.choices ?? []) as string[],
            correct_index: Number(q.correct_index ?? 0),
            explanation: q.explanation == null ? null : String(q.explanation)
          }));

          if (locale !== "fr" && questions.length > 0) {
            const ids = questions.map((q) => q.id);
            const { data: trs } = await supabase
              .from("content_translations")
              .select("entity_id,content")
              .eq("entity_type", "quiz_question")
              .in("entity_id", ids)
              .eq("lang", locale);
            const byId = new Map<string, any>();
            (trs ?? []).forEach((r: any) => {
              try {
                byId.set(String(r.entity_id), JSON.parse(String(r.content ?? "{}")));
              } catch {
                // ignore
              }
            });
            questions = questions.map((q) => {
              const tr = byId.get(q.id);
              if (!tr) return q;
              return {
                ...q,
                prompt: typeof tr.prompt === "string" ? tr.prompt : q.prompt,
                choices: Array.isArray(tr.choices) ? tr.choices : q.choices,
                explanation: typeof tr.explanation === "string" ? tr.explanation : q.explanation
              };
            });
          }

          return { title: setTitle, questions };
        };

        let payload: any = null;
        let rpcErr: any = null;

        const r1 = await supabase.rpc("pvp_get_challenge_detail", { p_challenge_id: challengeId, p_lang: locale });
        payload = r1.data;
        rpcErr = r1.error;
        if (rpcErr && isRpcMissingFunction(rpcErr)) {
          const r2 = await supabase.rpc("pvp_get_challenge_detail", { challenge_id: challengeId, lang: locale });
          payload = r2.data;
          rpcErr = r2.error;
        }

        if (rpcErr) {
          const fb = await fetchFallback(String((challengeRow as any).quiz_set_id));
          setQuizTitle(fb.title);
          setQuestions(fb.questions);
        } else {
          const p = payload as unknown as RpcPayload | null;
          if (!p?.quiz_set) {
            setError("Quiz set not found.");
            return;
          }
          setQuizTitle(String((p.quiz_set as any).title ?? "(quiz)"));
          setQuestions(((p as any).questions ?? []) as QuestionRow[]);
        }

        // Names
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id,username")
          .in("id", [created_by, opponent_id]);

        const byId = new Map<string, string>();
        (profiles ?? []).forEach((p: any) => byId.set(String(p.id), String(p.username ?? String(p.id).slice(0, 8))));
        setChallengerName(byId.get(created_by) ?? created_by.slice(0, 8));
        setOpponentName(byId.get(opponent_id) ?? opponent_id.slice(0, 8));

        // Attempts
        const { data: attemptsRaw } = await supabase
          .from("pvp_attempts")
          .select("user_id,score,total,duration_seconds,submitted_at")
          .eq("challenge_id", challengeId);

        const attemptRows: AttemptRow[] = (attemptsRaw ?? []).map((a: any) => ({
          user_id: String(a.user_id),
          score: Number(a.score ?? 0),
          total: Number(a.total ?? 0),
          duration_seconds: Number(a.duration_seconds ?? 0),
          submitted_at: String(a.submitted_at)
        }));
        setAttempts(attemptRows);

        // Elo / rating event (optional; only exists when the duel is rated).
        const { data: eventRaw } = await supabase
          .from("pvp_rating_events")
          .select(
            "challenge_id,challenger_id,opponent_id,challenger_delta,opponent_delta,challenger_after,opponent_after,scored_at"
          )
          .eq("challenge_id", challengeId)
          .order("scored_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        setRatingEvent((eventRaw as any) ?? null);

        const { data: ratingsRaw } = await supabase
          .from("ratings")
          .select("user_id,elo")
          .in("user_id", [created_by, opponent_id]);

        const nextElos: Record<string, number | null> = {};
        (ratingsRaw ?? []).forEach((r: any) => {
          nextElos[String(r.user_id)] = r.elo == null ? null : Number(r.elo);
        });
        setElos(nextElos);


        // Questions already returned by the RPC (and translated when available).
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        if (alive) setLoading(false);
      }
    }

    void run();

    return () => {
      alive = false;
    };
  }, [challengeId, locale, router, supabase]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-2xl border p-4 text-sm opacity-80">Loading…</div>
      </div>
    );
  }

  if (error || !meId || !challenge) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-2xl border p-4 text-sm">{error ?? "Not available"}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PvpChallengeView
        meId={meId}
        challenge={challenge}
        quizTitle={quizTitle}
        challengerName={challengerName}
        opponentName={opponentName}
        initialAttempts={attempts}
        questions={questions}
        ratingEvent={ratingEvent}
        elos={elos}
      />
    </div>
  );
}
