import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/core";
import { levelInfoFromXp } from "@/lib/leveling";

export default async function Dashboard() {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect("/login");

  const [{ data: ratingRow }, { data: profileRow }, { count: docsCount }, { count: setsCount }, { count: qcmCount }] = await Promise.all([
    supabase.from("ratings").select("elo,games_played").eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("xp_total").eq("id", user.id).maybeSingle(),
    supabase.from("documents").select("*", { count: "exact", head: true }),
    supabase.from("flashcard_sets").select("*", { count: "exact", head: true }),
    supabase.from("quiz_sets").select("*", { count: "exact", head: true })
  ]);

  const rating = (ratingRow as any)?.elo ?? 1200;
  const games = (ratingRow as any)?.games_played ?? 0;

  const xpTotal = Number((profileRow as any)?.xp_total ?? 0) || 0;
  const lvl = levelInfoFromXp(xpTotal).level;

  return (
    <div className="grid gap-4">
      <div className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{t(locale, "dashboard.title")}</h1>
            <p className="mt-2 max-w-[72ch] text-sm text-white/80">{t(locale, "dashboard.subtitle")}</p>
          </div>
          </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="card-soft p-4">
            <div className="text-xs opacity-70">XP</div>
            <div className="mt-1 text-2xl font-semibold">Niveau {lvl}</div>
            <div className="text-xs opacity-70">{xpTotal} XP</div>
          </div>

          <div className="card-soft p-4">
            <div className="text-xs opacity-70">{t(locale, "dashboard.elo")}</div>
            <div className="mt-1 text-2xl font-semibold">{rating}</div>
            <div className="text-xs opacity-70">{t(locale, "dashboard.games", { n: games })}</div>
          </div>

          <div className="card-soft p-4">
            <div className="text-xs opacity-70">{t(locale, "dashboard.pdfs")}</div>
            <div className="mt-1 text-2xl font-semibold">{docsCount ?? 0}</div>
          </div>

          <div className="card-soft p-4">
            <div className="text-xs opacity-70">{t(locale, "dashboard.sets")}</div>
            <div className="mt-1 text-2xl font-semibold">{setsCount ?? 0}</div>
          </div>

          <div className="card-soft p-4">
            <div className="text-xs opacity-70">{t(locale, "qcm.title")}</div>
            <div className="mt-1 text-2xl font-semibold">{qcmCount ?? 0}</div>
          </div>
        </div>
      </div>

      {/* Daily activity (UI-only for now) */}
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">{t(locale, "dashboard.dailyTitle")}</h2>
            <p className="mt-1 max-w-[72ch] text-sm text-white/80">{t(locale, "dashboard.dailySubtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/qcm" className="btn btn-secondary">
              {t(locale, "dashboard.dailyGoQcm")}
            </Link>
            <Link href="/exercises" className="btn btn-ghost">
              {t(locale, "dashboard.dailyGoExercises")}
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="card-soft p-4">
            <div className="text-xs font-medium opacity-70">{t(locale, "dashboard.dailyQcm")}</div>
            <div className="mt-3 grid gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <label key={`q-${i}`} className="flex items-center gap-2 text-sm opacity-90">
                  <input type="checkbox" disabled className="accent-white/80" />
                  <span>{t(locale, "dashboard.dailyQcmItem", { n: i + 1 })}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="card-soft p-4">
            <div className="text-xs font-medium opacity-70">{t(locale, "dashboard.dailyExercises")}</div>
            <div className="mt-3 grid gap-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <label key={`e-${i}`} className="flex items-center gap-2 text-sm opacity-90">
                  <input type="checkbox" disabled className="accent-white/80" />
                  <span>{t(locale, "dashboard.dailyExerciseItem", { n: i + 1 })}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs opacity-70">{t(locale, "dashboard.dailyFootnote")}</div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold">{t(locale, "dashboard.nextTitle")}</h2>
        <ul className="mt-3 list-disc pl-5 text-sm opacity-90">
          <li>{t(locale, "dashboard.next1")}</li>
          <li>{t(locale, "dashboard.next2")}</li>
          <li>{t(locale, "dashboard.next3")}</li>
        </ul>
      </div>
    </div>
  );
}
