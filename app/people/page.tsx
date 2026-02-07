import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/core";
import { levelInfoFromXp } from "@/lib/leveling";

type Profile = {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
  xp_total?: number | null;
};

type Rating = {
  user_id: string;
  elo?: number | null;
  games_played?: number | null;
};

type SearchParams = {
  q?: string;
  view?: string;
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function shortId(id: string) {
  return id ? id.split("-")[0] : "";
}

export default async function PeoplePage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim();
  const view = ((sp.view ?? "all") as "all" | "groups");

  const locale = await getLocale();
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) redirect("/login");

  const title = t(locale, "nav.people");
  const subtitle =
    locale === "fr"
      ? "Annuaire global + classement ELO."
      : "Global directory + ELO leaderboard.";

  // -----------------------------
  // 1) Fetch group ids of current user
  // -----------------------------
  const { data: myGroupsRaw } = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("user_id", user.id);

  const myGroupIds = uniq((myGroupsRaw ?? []).map((r: any) => r.group_id).filter(Boolean));

  // -----------------------------
  // 2) Fetch profiles (ALL) with search, OR group-only list
  // -----------------------------
  let people: Profile[] = [];

  if (view === "groups") {
    // members of any of my groups (dedup)
    if (myGroupIds.length > 0) {
      const { data: membersRaw } = await supabase
        .from("group_memberships")
        .select("user_id")
        .in("group_id", myGroupIds);

      const memberIds = uniq((membersRaw ?? []).map((m: any) => m.user_id).filter(Boolean));

      if (memberIds.length > 0) {
        const profilesRes = await supabase
          .from("profiles")
          // Privacy: do not fetch or display Google full_name here.
          .select("id,username,avatar_url,xp_total")
          .in("id", memberIds)
          .order("username", { ascending: true });

        people = (profilesRes.data ?? []) as any;
      }
    }
  } else {
    // ALL PROFILES (limit for scalability)
    let queryBuilder = supabase
      .from("profiles")
      // Privacy: do not fetch or display Google full_name here.
      .select("id,username,avatar_url,xp_total")
      .order("username", { ascending: true })
      .limit(200);

    if (q) {
      queryBuilder = queryBuilder.or(`username.ilike.%${q}%`);
    }

    const profilesRes = await queryBuilder;
    people = (profilesRes.data ?? []) as any;
  }

  const peopleIds = people.map((p) => p.id);

  // -----------------------------
  // 3) Fetch ratings for people list (elo + games)
  // -----------------------------
  const ratingByUser = new Map<string, Rating>();

  // Admin badge (public): best-effort read of admin list for displayed users
  const adminIds = new Set<string>();
  try {
    if (peopleIds.length > 0) {
      const { data: adminsRaw } = await supabase
        .from("app_admins")
        .select("user_id")
        .in("user_id", peopleIds);
      (adminsRaw ?? []).forEach((r: any) => {
        if (r?.user_id) adminIds.add(String(r.user_id));
      });
    }
  } catch {
    // If SQL patch not applied yet, we simply don't show badges.
  }

  if (peopleIds.length > 0) {
    const { data: ratingsRaw } = await supabase
      .from("ratings")
      .select("user_id,elo,games_played")
      .in("user_id", peopleIds);

    (ratingsRaw ?? []).forEach((r: any) => {
      ratingByUser.set(r.user_id, {
        user_id: r.user_id,
        elo: r.elo ?? null,
        games_played: r.games_played ?? null
      });
    });
  }

  // -----------------------------
  // 4) Leaderboard (Top 20)
  // -----------------------------
  const { data: topRatingsRaw } = await supabase
    .from("ratings")
    .select("user_id,elo,games_played")
    .order("elo", { ascending: false })
    .limit(20);

  const topUserIds = (topRatingsRaw ?? []).map((r: any) => r.user_id).filter(Boolean);

  // Include leaderboard users for admin badges
  try {
    const missing = topUserIds.filter((id) => !adminIds.has(String(id)));
    if (missing.length > 0) {
      const { data: adminsTop } = await supabase.from("app_admins").select("user_id").in("user_id", missing);
      (adminsTop ?? []).forEach((r: any) => {
        if (r?.user_id) adminIds.add(String(r.user_id));
      });
    }
  } catch {
    // ignore
  }

  const { data: topProfilesRaw } =
    topUserIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id,username,avatar_url,xp_total")
          .in("id", topUserIds)
      : { data: [] as any[] };

  const topProfileById = new Map<string, Profile>();
  (topProfilesRaw ?? []).forEach((p: any) => topProfileById.set(p.id, p));

  const leaderboard = (topRatingsRaw ?? []).map((r: any) => {
    const p = topProfileById.get(r.user_id);
    return {
      user_id: r.user_id,
      username: p?.username ?? shortId(r.user_id),
      avatar_url: p?.avatar_url ?? null,
      xp_total: Number((p as any)?.xp_total ?? 0) || 0,
      elo: r.elo ?? 1200,
      games_played: r.games_played ?? 0
    };
  });

  const isFr = locale === "fr";

  return (
    <div className="grid gap-4">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-white/80">{subtitle}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* LEFT: Directory */}
        <section className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">{isFr ? "Annuaire" : "Directory"}</div>
              <div className="mt-1 text-xs opacity-70">
                {isFr ? "Recherche + filtre (Tous / Mes groupes)." : "Search + filter (All / My groups)."}
              </div>
            </div>

            <div className="flex gap-2">
              <Link
                href={`/people?view=all${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={`chip ${view === "all" ? "chip-active" : ""}`}
              >
                {isFr ? "Tous" : "All"}
              </Link>
              <Link
                href={`/people?view=groups${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={`chip ${view === "groups" ? "chip-active" : ""}`}
              >
                {isFr ? "Mes groupes" : "My groups"}
              </Link>
            </div>
          </div>

          {/* Search */}
          <form className="mt-4 flex gap-2" action="/people" method="get">
            <input type="hidden" name="view" value={view} />
            <input
              name="q"
              defaultValue={q}
              placeholder={isFr ? "Rechercher un profil…" : "Search a profile…"}
              className="input"
            />
            <button
              type="submit"
              className="btn btn-secondary whitespace-nowrap"
            >
              {isFr ? "Filtrer" : "Filter"}
            </button>
          </form>

          {/* List */}
          <div className="mt-4 grid gap-2">
            {people.length === 0 ? (
              <div className="text-sm opacity-70">{isFr ? "Aucun profil trouvé." : "No profiles found."}</div>
            ) : (
              people.map((p) => {
                const rating = ratingByUser.get(p.id);
                const elo = rating?.elo ?? 1200;
                const games = rating?.games_played ?? 0;

                const xpTotal = Number((p as any).xp_total ?? 0) || 0;
                const lvl = levelInfoFromXp(xpTotal).level;

                const display = p.username || shortId(p.id);

                return (
                  <Link
                    key={p.id}
                    href={`/people/${p.id}`}
                    className={`card-soft p-4 transition hover:bg-white/[0.06] ${p.id === user.id ? "bg-white/[0.06]" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      {p.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.avatar_url} alt="avatar" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xs">
                          {display.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-semibold">
                            {display} <span className="opacity-60">{shortId(p.id)}</span>
                          </div>
                          {adminIds.has(p.id) ? <span className="badge badge-public">Admin</span> : null}
                        </div>
                        <div className="mt-1 text-xs opacity-80">
                          Niveau {lvl} • {xpTotal} XP • Elo: {elo} • {games} {isFr ? "parties" : "games"}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          <div className="mt-3 text-xs opacity-60">
            {isFr
              ? "Note: liste limitée à 200 profils (scalable via pagination plus tard)."
              : "Note: list limited to 200 profiles (paginate later for scale)."}
          </div>
        </section>

        {/* RIGHT: Elo Leaderboard */}
        <aside className="card p-6">
          <div className="text-sm font-semibold">{isFr ? "Classement ELO" : "ELO Ranking"}</div>
          <div className="mt-1 text-xs opacity-70">{isFr ? "Top 20 (global)." : "Top 20 (global)."}</div>

          <div className="mt-4 grid gap-2">
            {leaderboard.length === 0 ? (
              <div className="text-sm opacity-70">{isFr ? "Aucun classement." : "No ranking yet."}</div>
            ) : (
              leaderboard.map((row, idx) => (
                <Link
                  key={row.user_id}
                  href={`/people/${row.user_id}`}
                  className={`card-soft flex items-center justify-between px-3 py-2 transition hover:bg-white/[0.06] ${
                    row.user_id === user.id ? "bg-white/[0.06]" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 text-xs opacity-70">{idx + 1}</div>

                    {row.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.avatar_url} alt="avatar" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[10px]">
                        {String(row.username).slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-medium">{row.username}</div>
                        {adminIds.has(row.user_id) ? <span className="badge badge-public">Admin</span> : null}
                      </div>
                      <div className="text-[11px] opacity-70">
                        Niveau {levelInfoFromXp(Number((row as any).xp_total ?? 0) || 0).level} • {row.games_played} {isFr ? "parties" : "games"}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm font-semibold">{row.elo}</div>
                </Link>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}