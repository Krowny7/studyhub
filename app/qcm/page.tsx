import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QuizSetCreator } from "@/components/QuizSetCreator";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n/core";
import { SectionHeader } from "@/components/ContentFolderBlocks";
import { normalizeScope, sectionForVisibility, type ScopeFilter } from "@/lib/content/visibility";
import { CreateAction } from "@/components/CreateAction";
import { FloatingCreateAction } from "@/components/FloatingCreateAction";
import { VisibilityTabs } from "@/components/VisibilityTabs";
import { FolderDriveView, type FolderRow } from "@/components/FolderDriveView";
import { ContentItemCard } from "@/components/ContentItemCard";

type QcmRow = {
  id: string;
  title: string;
  visibility: string | null;
  created_at: string | null;
  is_official?: boolean | null;
  official_published?: boolean | null;
  difficulty?: string | null;
  folder_id?: string | null;
  library_folders?: { id: string | null; name: string | null; parent_id: string | null } | null;
};

type SearchParams = {
  q?: string;
  scope?: string;
  folder?: string;
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

function buildResetHref(basePath: string, scope: ScopeFilter, folder: string | null) {
  const sp = new URLSearchParams();
  if (scope && scope !== "private") sp.set("scope", scope);
  if (folder) sp.set("folder", folder);
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export default async function QcmPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};

  const locale: Locale = await getLocale();
  const isFR = locale === "fr";

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) redirect("/login");

  const q = (sp.q ?? "").trim();
  const rawScope = normalizeScope(sp.scope ?? "private") as ScopeFilter;
  const scope = (rawScope === "all" ? "private" : rawScope) as ScopeFilter;
  const folder = (sp.folder ?? "").trim() || null;

  const currentQuery = {
    ...(q ? { q } : {}),
    ...(scope && scope !== "private" ? { scope } : {}),
    ...(folder ? { folder } : {})
  };

  const rootLabel = t(locale, "folders.none");

  const [{ data: profile }, myRes, officialRes, foldersRes, { data: isAdminData }] = await Promise.all([
    supabase.from("profiles").select("active_group_id").eq("id", user.id).maybeSingle(),
    (async () => {
      let query = supabase
        .from("quiz_sets")
        .select(
          "id,title,visibility,created_at,is_official,official_published,difficulty,folder_id, library_folders(id,name,parent_id)"
        )
        // Treat curated/reference content as official_published=true. Anything else is considered "your sets".
        .neq("official_published", true)
        .order("created_at", { ascending: false });

      if (q) query = query.ilike("title", `%${q}%`);

      return await query;
    })(),
    (async () => {
      return await supabase
        .from("quiz_sets")
        .select(
          "id,title,visibility,created_at,is_official,official_published,difficulty,folder_id, library_folders(id,name,parent_id)"
        )
        .eq("is_official", true)
        .eq("official_published", true)
        .order("published_at", { ascending: false, nullsFirst: false });
    })(),
    supabase.from("library_folders").select("id,name,parent_id").eq("kind", "quizzes").order("name", { ascending: true }),
    supabase.rpc("is_app_admin")
  ]);

  const activeGroupId = (profile as any)?.active_group_id ?? null;
  const isAdmin = Boolean(isAdminData);

  let allRaw = (myRes.data ?? []) as unknown as QcmRow[];
  let official = (officialRes.data ?? []) as unknown as QcmRow[];
  const folders = (foldersRes.data ?? []) as unknown as FolderRow[];

  // Best-effort localization (EN) for titles (including reference content).
  if (locale === "en") {
    const ids = Array.from(new Set([...allRaw.map((s) => s.id), ...official.map((s) => s.id)])).filter(Boolean);
    if (ids.length) {
      const chunkSize = 500;
      const trRows: any[] = [];
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const { data } = await supabase
          .from("content_translations")
          .select("content_id,payload")
          .eq("content_type", "quiz_set")
          .eq("lang", "en")
          .in("content_id", chunk);
        if (data?.length) trRows.push(...(data as any[]));
      }

      const byId = new Map<string, any>();
      (trRows ?? []).forEach((r: any) => byId.set(String(r.content_id), (r as any).payload));

      const localizeTitle = (row: QcmRow) => {
        const p = byId.get(String(row.id));
        const next = p?.title ? String(p.title) : row.title;
        return { ...row, title: next };
      };

      allRaw = allRaw.map(localizeTitle);
      official = official.map(localizeTitle);
    }
  }

  // Note: Tags were removed from the UX to keep QCM browsing simple.
  const all = allRaw;

  const priv = all.filter((s) => sectionForVisibility(s.visibility) === "private");
  const shared = all.filter((s) => sectionForVisibility(s.visibility) === "shared");
  const pub = all.filter((s) => sectionForVisibility(s.visibility) === "public");

  const L = {
    infoTitle: t(locale, "qcm.title"),
    hero1: t(locale, "qcm.subtitle"),

    your: t(locale, "qcm.yourSets"),
    searchPlaceholder: isFR ? "Rechercher un set…" : "Search a set…",
    filterBtn: isFR ? "Filtrer" : "Filter",
    reset: isFR ? "Réinitialiser" : "Reset",

    private: isFR ? "Privés" : "Private",
    shared: isFR ? "Groupes" : "Groups",
    public: isFR ? "Publics" : "Public",

    open: t(locale, "qcm.open"),

    subtitlePrivate: isFR ? "Visible uniquement par toi." : "Visible only to you.",
    subtitleShared: isFR ? "Visibles pour certains groupes." : "Visible to selected groups.",
    subtitlePublic: isFR ? "Visibles par tous (selon tes règles)." : "Visible to everyone (per your rules).",

    emptyPrivate: isFR ? "Aucun set privé." : "No private set.",
    emptyShared: isFR ? "Aucun set partagé." : "No shared set.",
    emptyPublic: isFR ? "Aucun set public." : "No public set.",
    nothingFound: t(locale, "qcm.empty"),

    official: t(locale, "qcm.referenceTitle"),
    officialSubtitle: t(locale, "qcm.referenceSubtitle")
  };

  const resetHref = buildResetHref("/qcm", scope, folder);

  function renderScopeSection(tone: "private" | "shared" | "public", title: string, subtitle: string, items: any[], empty: string) {
    return (
      <div className="mt-4">
        <SectionHeader title={title} subtitle={subtitle} count={items.length} tone={tone} />
        <div className="mt-3">
          <FolderDriveView
            folders={folders}
            items={items}
            currentFolderId={folder}
            basePath="/qcm"
            currentQuery={currentQuery}
            rootLabel={rootLabel}
            homeLabel={isFR ? "Tous les sets" : "All sets"}
            openLabel={L.open}
            emptyLabel={empty}
            upLabel={isFR ? "↑ Retour" : "↑ Up"}
            folderKind="quizzes"
            itemActions={{ table: "quiz_sets", shareTable: "quiz_set_shares", shareFk: "set_id", activeGroupId }}
            enableLocalSearch={false}
            newFolderLabel={isFR ? "+ Dossier" : "+ Folder"}
            newFolderPlaceholder={t(locale, "folders.newPlaceholder")}
            createFolderLabel={t(locale, "folders.create")}
            cancelLabel={isFR ? "Annuler" : "Cancel"}
            savingLabel={t(locale, "common.saving")}
            subfoldersLabel={isFR ? "sous-dossiers" : "subfolders"}
            itemsLabel={isFR ? "éléments" : "items"}
            emptyFolderLabel={isFR ? "Vide" : "Empty"}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {/* Hero (create is behind a + button to keep the page clean) */}
      <div className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold opacity-80">{L.infoTitle}</div>
            <div className="mt-3 max-w-[68ch] text-base text-white/80">{L.hero1}</div>
          </div>
          <div className="hidden sm:block">
            <CreateAction title={t(locale, "qcm.createTitle")} buttonLabel={isFR ? "Créer" : "Create"} iconOnly={true}>
              <QuizSetCreator activeGroupId={activeGroupId} isAdmin={isAdmin} />
            </CreateAction>
          </div>
        </div>
      </div>

      {/* Mobile floating + */}
      <FloatingCreateAction title={t(locale, "qcm.createTitle")} buttonLabel={isFR ? "Créer" : "Create"}>
        <QuizSetCreator activeGroupId={activeGroupId} isAdmin={isAdmin} />
      </FloatingCreateAction>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Your sets */}
        <div className="card p-5 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">{L.your}</h2>
          <div className="text-xs opacity-70">{all.length}</div>
        </div>

        <div className="mt-4">
          <VisibilityTabs
            basePath="/qcm"
            currentQuery={currentQuery}
            active={(scope as any)}
            labels={{ private: L.private, shared: L.shared, public: L.public }}
            counts={{ private: priv.length, shared: shared.length, public: pub.length }}
          />
        </div>

        {/* Search (tags removed to simplify the UX) */}
        <form className="mt-4 flex flex-wrap items-center gap-2" action="/qcm" method="get">
          <input name="q" defaultValue={q} placeholder={L.searchPlaceholder} className="input sm:w-[260px]" />
          <input type="hidden" name="scope" value={scope} />
          <input type="hidden" name="folder" value={folder ?? ""} />

          <button type="submit" className="btn btn-secondary whitespace-nowrap">
            {L.filterBtn}
          </button>

          {q || scope !== "private" ? (
            <Link href={resetHref} className="btn btn-ghost whitespace-nowrap">
              {L.reset}
            </Link>
          ) : null}
        </form>

        {/* Content */}
        {scope === "private" ? renderScopeSection("private", L.private, L.subtitlePrivate, priv, L.emptyPrivate) : null}
        {scope === "shared" ? renderScopeSection("shared", L.shared, L.subtitleShared, shared, L.emptyShared) : null}
        {scope === "public" ? renderScopeSection("public", L.public, L.subtitlePublic, pub, L.emptyPublic) : null}

        </div>

        {/* Reference / curated sets */}
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{L.official}</div>
              <div className="mt-1 text-xs opacity-70">{L.officialSubtitle}</div>
            </div>
            <div className="text-xs opacity-70">{official.length}</div>
          </div>

          <div className="mt-4">
            {official.length ? (
              <div className="grid gap-3">
                {(official as any).map((it: any) => (
                  <ContentItemCard
                    key={it.id}
                    itemId={it.id}
                    href={`/qcm/${it.id}`}
                    title={it.title}
                    visibility={it.visibility}
                    folderLabel={it.library_folders?.name ?? rootLabel}
                    rootLabel={rootLabel}
                  />
                ))}
              </div>
            ) : (
              <div className="text-sm opacity-70">{t(locale, "qcm.referenceEmpty")}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
