import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/core";
import { LevelBar } from "@/components/LevelBar";
import { XpBarChart, type XpDay } from "@/components/XpBarChart";
import { levelInfoFromXp } from "@/lib/leveling";

type PageProps = {
  params: Promise<{ id: string }>;
};

function shortId(id: string) {
  return id ? id.split("-")[0] : "";
}

function initials(label: string) {
  const base = (label || "U").replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const parts = base.split(" ").filter(Boolean);
  const a = parts[0]?.[0] ?? "U";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

export default async function PersonProfilePage({ params }: PageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) redirect("/login");

  // Badge should be visible to everyone: fetch admin status for the viewed profile.
  let isTargetAdmin = false;
  try {
    const { data: targetAdminData } = await supabase.rpc("is_user_app_admin", { p_user_id: id });
    isTargetAdmin = Boolean(targetAdminData);
  } catch {
    // Backward compatibility if SQL patch not applied yet.
    isTargetAdmin = false;
  }

  const [{ data: profile }, { data: ratingRow }] = await Promise.all([
    supabase
      .from("profiles")
      // Privacy: do not fetch or display Google full_name here.
      .select("id,username,avatar_url,xp_total")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("ratings").select("elo,games_played").eq("user_id", id).maybeSingle()
  ]);

  if (!profile) notFound();

  // Mutual groups (best-effort): count intersection between group memberships.
  const [{ data: myGroups }, { data: theirGroups }] = await Promise.all([
    supabase.from("group_memberships").select("group_id").eq("user_id", user.id),
    supabase.from("group_memberships").select("group_id").eq("user_id", id)
  ]);

  const myIds = new Set((myGroups ?? []).map((g: any) => g.group_id).filter(Boolean));
  const mutualCount = (theirGroups ?? []).map((g: any) => g.group_id).filter(Boolean).filter((gid: any) => myIds.has(gid)).length;

  const username = (profile as any)?.username ?? null;
  const avatarUrl = (profile as any)?.avatar_url ?? null;
  const display = username || shortId(id);

  const xpTotal = Number((profile as any)?.xp_total ?? 0) || 0;
  const lvlInfo = levelInfoFromXp(xpTotal);

  const elo = (ratingRow as any)?.elo ?? 1200;
  const games = (ratingRow as any)?.games_played ?? 0;

  const isMe = user.id === id;

  let xpDaily: XpDay[] | null = null;
  try {
    const { data } = await supabase.rpc("get_xp_daily_for_user", { p_user_id: id, p_days: 90 });
    if (Array.isArray(data)) {
      xpDaily = data.slice(0, 90).map((d: any) => ({ day: String(d.day), xp: Number(d.xp ?? 0) || 0 }));
    }
  } catch {
    // If the SQL file hasn't been applied yet, the chart will simply not show.
  }

  return (
    <div className="grid gap-4">
      <div className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{t(locale, "nav.people")}</div>
            <div className="mt-1 text-xs opacity-70">
              <Link href="/people" className="hover:underline">
                {locale === "fr" ? "Retour à l’annuaire" : "Back to directory"}
              </Link>
            </div>
          </div>

          {user.id === id ? (
            <Link href="/settings" className="btn btn-secondary">
              {t(locale, "nav.settings")}
            </Link>
          ) : null}
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
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {display} <span className="text-sm font-medium opacity-60">{shortId(id)}</span>
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="badge badge-private">Niveau {lvlInfo.level}</span>
              {isTargetAdmin ? (
                <span className="badge badge-public">{t(locale, "profile.adminBadge")}</span>
              ) : null}
              <span className="badge badge-shared">{xpTotal} XP</span>
              <span className="badge badge-public">Elo: {elo}</span>
              <span className="badge badge-shared">
                {games} {locale === "fr" ? "parties" : "games"}
              </span>
              <span className="badge badge-private">
                {mutualCount} {locale === "fr" ? "groupe(s) en commun" : "mutual group(s)"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-semibold">{locale === "fr" ? "Progression" : "Progress"}</h2>
          <div className="mt-2">
            <LevelBar xpTotal={xpTotal} />
          </div>

          <div className="mt-4 grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="opacity-70">{locale === "fr" ? "XP total" : "Total XP"}</span>
              <span className="font-medium">{xpTotal}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="opacity-70">{locale === "fr" ? "Niveau" : "Level"}</span>
              <span className="font-medium">{lvlInfo.level}</span>
            </div>
          </div>

          <div className="mt-4 text-xs opacity-70">
            {locale === "fr"
              ? "XP gagnée uniquement sur les QCM de référence (questions justes)."
              : "XP is earned only on reference quizzes (correct answers)."}
          </div>
        </div>

        {xpDaily ? (
          <XpBarChart data={xpDaily} title={locale === "fr" ? "XP gagnée par jour (90 jours)" : "Daily XP (90 days)"} />
        ) : (
          <div className="card p-6">
            <h2 className="font-semibold">{locale === "fr" ? "Stats" : "Stats"}</h2>
            <div className="mt-2 text-sm text-white/80">
              {locale === "fr"
                ? "Applique le fichier SQL Supabase pour activer le graphe."
                : "Apply the Supabase SQL file to enable the chart."}
            </div>
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold">{locale === "fr" ? "Informations" : "Information"}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="card-soft p-4">
            <div className="text-xs opacity-70">{locale === "fr" ? "Identité" : "Identity"}</div>
            <div className="mt-1 text-sm font-medium">
              {locale === "fr" ? "Pseudo" : "Handle"}: <span className="opacity-90">{username ?? "—"}</span>
            </div>
            <div className="mt-1 text-xs opacity-70">
              {locale === "fr"
                ? "On n’affiche pas le nom Google (full_name) pour respecter la confidentialité."
                : "We do not display the Google name (full_name) for privacy."}
            </div>
          </div>

          <div className="card-soft p-4">
            <div className="text-xs opacity-70">{locale === "fr" ? "Actions" : "Actions"}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/people" className="btn btn-secondary">
                {locale === "fr" ? "Voir d’autres profils" : "Browse people"}
              </Link>
              {!isMe ? (
                <button type="button" className="btn btn-ghost" disabled>
                  {locale === "fr" ? "Ajouter en ami (bientôt)" : "Add friend (soon)"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
