export const dynamic = "force-dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/core";

type ChallengeRow = {
  id: string;
  quiz_set_id: string;
  created_by: string;
  opponent_id: string;
  status: string;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
};

function fmtDate(d: string, locale: string) {
  try {
    return new Date(d).toLocaleString(locale === "fr" ? "fr-FR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return d;
  }
}

export default async function ChallengesPage() {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="card p-6">
          <div className="text-xl font-semibold">{t(locale, "pvp.challenges")}</div>
          <div className="mt-2 text-sm opacity-70">
            {locale === "fr" ? "Connecte-toi pour voir tes duels." : "Sign in to see your duels."}
          </div>
          <Link href="/login" className="btn btn-primary mt-5 w-fit">
            {t(locale, "auth.login")}
          </Link>
        </div>
      </div>
    );
  }

  const { data: rows } = await supabase
    .from("pvp_challenges")
    .select("id,quiz_set_id,created_by,opponent_id,status,created_at,accepted_at,completed_at")
    .or(`created_by.eq.${user.id},opponent_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(200);

  const challenges = (rows ?? []) as any as ChallengeRow[];

  const setIds = Array.from(new Set(challenges.map((c) => c.quiz_set_id)));
  const userIds = Array.from(new Set(challenges.flatMap((c) => [c.created_by, c.opponent_id])));

  const { data: setsRaw } =
    setIds.length > 0
      ? await supabase.from("quiz_sets").select("id,title").in("id", setIds)
      : { data: [] as any[] };

  const setTitleById = new Map<string, string>();
  (setsRaw ?? []).forEach((s: any) => setTitleById.set(String(s.id), String(s.title ?? "(untitled)")));

  const { data: profilesRaw } =
    userIds.length > 0
      ? await supabase.from("profiles").select("id,username").in("id", userIds)
      : { data: [] as any[] };

  const nameById = new Map<string, string>();
  (profilesRaw ?? []).forEach((p: any) => nameById.set(String(p.id), String(p.username ?? p.id.slice(0, 8))));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t(locale, "pvp.challenges")}</h1>
          <div className="mt-1 text-sm opacity-70">
            {locale === "fr"
              ? "Le classement Elo n’évolue que via des duels sur des QCM officiels."
              : "Elo changes only through duels on official quizzes."}
          </div>
        </div>
        <Link href="/qcm" className="btn btn-secondary">
          {t(locale, "nav.qcm")}
        </Link>
      </div>

      <div className="mt-6 grid gap-3">
        {challenges.length === 0 ? (
          <div className="card p-6">
            <div className="text-sm opacity-70">
              {locale === "fr" ? "Aucun duel pour l’instant." : "No duels yet."}
            </div>
          </div>
        ) : (
          challenges.map((c) => {
            const title = setTitleById.get(c.quiz_set_id) ?? "(quiz)";
            const challenger = nameById.get(c.created_by) ?? c.created_by.slice(0, 8);
            const opponent = nameById.get(c.opponent_id) ?? c.opponent_id.slice(0, 8);
            const mine = c.created_by === user.id ? (locale === "fr" ? "(créé par toi)" : "(you)" ) : (c.opponent_id === user.id ? (locale === "fr" ? "(invité)" : "(invited)" ) : "");

            return (
              <Link key={c.id} href={`/challenges/${c.id}`} className="card-soft p-4 hover:bg-white/[0.06]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold break-words">{title}</div>
                    <div className="mt-1 text-xs opacity-70">
                      {challenger} vs {opponent} {mine} • {t(locale, `pvp.${c.status}` as any) ?? c.status}
                    </div>
                    <div className="mt-1 text-[11px] opacity-60">
                      {fmtDate(c.created_at, locale)}
                    </div>
                  </div>
                  <div className="badge badge-neutral w-fit">{c.status}</div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
