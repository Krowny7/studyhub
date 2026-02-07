import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/core";
import { LevelBar } from "@/components/LevelBar";
import { XpBarChart, type XpDay } from "@/components/XpBarChart";
import { levelInfoFromXp } from "@/lib/leveling";

function initials(label: string) {
  const base = (label || "U").replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const parts = base.split(" ").filter(Boolean);
  const a = parts[0]?.[0] ?? "U";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

export default async function ProfilePage() {
  const locale = await getLocale();
  const isFR = locale === "fr";
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) redirect("/login");

  const [{ data: profile }, { data: ratingRow }, { data: isAdminData }] = await Promise.all([
    supabase.from("profiles").select("id,username,avatar_url,xp_total").eq("id", user.id).maybeSingle(),
    supabase.from("ratings").select("elo,games_played").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("is_app_admin")
  ]);

  const isAdmin = Boolean(isAdminData);

  const username = (profile as any)?.username ?? null;
  const avatarUrl = (profile as any)?.avatar_url ?? null;
  const display = username || user.email || "User";

  const xpTotal = Number((profile as any)?.xp_total ?? 0) || 0;
  const lvlInfo = levelInfoFromXp(xpTotal);
  const elo = (ratingRow as any)?.elo ?? 1200;
  const games = (ratingRow as any)?.games_played ?? 0;

  let xpDaily: XpDay[] | null = null;
  try {
    const { data } = await supabase.rpc("get_xp_daily", { p_days: 90 });
    if (Array.isArray(data)) {
      xpDaily = data.slice(0, 90).map((d: any) => ({ day: String(d.day), xp: Number(d.xp ?? 0) || 0 }));
    }
  } catch {
    // Chart will be hidden if the SQL hasn't been applied yet.
  }

  return (
    <div className="grid gap-4">
      <div className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{t(locale, "profile.title")}</div>
            <div className="mt-1 text-xs opacity-70">
              <Link href="/people" className="hover:underline">
                {isFR ? "Voir l’annuaire" : "Browse people"}
              </Link>
            </div>
          </div>
          <Link href="/settings" className="btn btn-secondary">
            {t(locale, "nav.settings")}
          </Link>
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="avatar" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-sm">
              {initials(display)}
            </div>
          )}

          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{display}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="badge badge-private">{isFR ? `Niveau ${lvlInfo.level}` : `Level ${lvlInfo.level}`}</span>
              {isAdmin ? <span className="badge badge-public">{t(locale, "profile.adminBadge")}</span> : null}
              <span className="badge badge-shared">{xpTotal} XP</span>
              <span className="badge badge-public">Elo: {elo}</span>
              <span className="badge badge-shared">{games} {isFR ? "parties" : "games"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-semibold">{isFR ? "Progression" : "Progress"}</h2>
          <div className="mt-2">
            <LevelBar xpTotal={xpTotal} />
          </div>

          <div className="mt-4 text-xs opacity-70">
            {isFR
              ? "XP gagnée uniquement sur les QCM de référence (questions justes)."
              : "XP is earned only on reference quizzes (correct answers)."}
          </div>
        </div>

        {xpDaily ? (
          <XpBarChart data={xpDaily} title={isFR ? "XP gagnée par jour (90 jours)" : "Daily XP (90 days)"} />
        ) : (
          <div className="card p-6">
            <h2 className="font-semibold">{isFR ? "Activité" : "Activity"}</h2>
            <div className="mt-2 text-sm text-white/80">
              {isFR
                ? "Applique le fichier SQL Supabase pour activer le graphe."
                : "Apply the Supabase SQL file to enable the chart."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
