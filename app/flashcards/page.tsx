import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FlashcardSetCreator } from "@/components/FlashcardSetCreator";
import { getLocale } from "@/lib/i18n/server";
import { t, type Locale } from "@/lib/i18n/core";
import { SectionHeader } from "@/components/ContentFolderBlocks";
import { normalizeScope, sectionForVisibility, type ScopeFilter } from "@/lib/content/visibility";
import { CreateAction } from "@/components/CreateAction";
import { FloatingCreateAction } from "@/components/FloatingCreateAction";
import { VisibilityTabs } from "@/components/VisibilityTabs";
import { FolderDriveView, type FolderRow } from "@/components/FolderDriveView";

type SetRow = {
  id: string;
  title: string;
  visibility: string | null;
  created_at: string | null;
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

export default async function FlashcardsPage({ searchParams }: PageProps) {
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

  const [{ data: profile }, setsRes, foldersRes] = await Promise.all([
    supabase.from("profiles").select("active_group_id").eq("id", user.id).maybeSingle(),
    (async () => {
      let query = supabase
        .from("flashcard_sets")
        .select("id,title,visibility,created_at,folder_id, library_folders(id,name,parent_id)")
        .order("created_at", { ascending: false });

      if (q) query = query.ilike("title", `%${q}%`);
      return await query;
    })(),
    supabase
      .from("library_folders")
      .select("id,name,parent_id")
      .eq("kind", "flashcards")
      .order("name", { ascending: true })
  ]);

  const activeGroupId = (profile as any)?.active_group_id ?? null;

  let allRaw = (setsRes.data ?? []) as unknown as SetRow[];
  const folders = (foldersRes.data ?? []) as unknown as FolderRow[];

  // Best-effort localization (EN) for set titles.
  if (locale === "en") {
    const ids = Array.from(new Set(allRaw.map((s) => s.id))).filter(Boolean);
    if (ids.length) {
      const chunkSize = 500;
      const trRows: any[] = [];
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const { data } = await supabase
          .from("content_translations")
          .select("content_id,payload")
          .eq("content_type", "flashcard_set")
          .eq("lang", "en")
          .in("content_id", chunk);
        if (data?.length) trRows.push(...(data as any[]));
      }

      const byId = new Map<string, any>();
      (trRows ?? []).forEach((r: any) => byId.set(String(r.content_id), (r as any).payload));

      allRaw = allRaw.map((row) => {
        const p = byId.get(String(row.id));
        const title = p?.title ? String(p.title) : row.title;
        return { ...row, title };
      });
    }
  }

  // Note: Tags were removed from the UX to keep flashcards simple.
  const all = allRaw;

  const priv = all.filter((s) => sectionForVisibility(s.visibility) === "private");
  const shared = all.filter((s) => sectionForVisibility(s.visibility) === "shared");
  const pub = all.filter((s) => sectionForVisibility(s.visibility) === "public");

  const L = {
    infoTitle: t(locale, "flashcards.title"),
    hero1: t(locale, "flashcards.subtitle"),

    your: t(locale, "flashcards.yourSets"),
    searchPlaceholder: isFR ? "Rechercher un set…" : "Search a set…",
    filterBtn: isFR ? "Filtrer" : "Filter",
    reset: isFR ? "Réinitialiser" : "Reset",

    private: isFR ? "Privés" : "Private",
    shared: isFR ? "Groupes" : "Groups",
    public: isFR ? "Publics" : "Public",

    open: t(locale, "flashcards.open"),

    subtitlePrivate: isFR ? "Visible uniquement par toi." : "Visible only to you.",
    subtitleShared: isFR ? "Visibles pour certains groupes." : "Visible to selected groups.",
    subtitlePublic: isFR ? "Visibles par tous (selon tes règles)." : "Visible to everyone (per your rules).",

    emptyPrivate: isFR ? "Aucun set privé." : "No private set.",
    emptyShared: isFR ? "Aucun set partagé." : "No shared set.",
    emptyPublic: isFR ? "Aucun set public." : "No public set.",
    nothingFound: t(locale, "flashcards.empty")
  };

  const resetHref = buildResetHref("/flashcards", scope, folder);

  function renderScopeSection(tone: "private" | "shared" | "public", title: string, subtitle: string, items: any[], empty: string) {
    return (
      <div className="mt-4">
        <SectionHeader title={title} subtitle={subtitle} count={items.length} tone={tone} />
        <div className="mt-3">
          <FolderDriveView
            folders={folders}
            items={items}
            currentFolderId={folder}
            basePath="/flashcards"
            currentQuery={currentQuery}
            rootLabel={rootLabel}
            homeLabel={isFR ? "Tous les sets" : "All sets"}
            openLabel={L.open}
            upLabel={isFR ? "↑ Retour" : "↑ Up"}
            emptyLabel={empty}
            folderKind="flashcards"
            itemActions={{ table: "flashcard_sets", shareTable: "flashcard_set_shares", shareFk: "set_id", activeGroupId }}
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
      {/* Hero */}
      <div className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold opacity-80">{L.infoTitle}</div>
            <div className="mt-3 max-w-[68ch] text-base text-white/80">{L.hero1}</div>
          </div>
          <div className="hidden sm:block">
            <CreateAction
              title={t(locale, "flashcards.createTitle")}
              buttonLabel={isFR ? "Créer un set" : "Create a set"}
              iconOnly={true}
            >
              <FlashcardSetCreator activeGroupId={activeGroupId} />
            </CreateAction>
          </div>
        </div>
      </div>

      {/* Mobile floating + */}
      <FloatingCreateAction title={t(locale, "flashcards.createTitle")} buttonLabel={isFR ? "Créer un set" : "Create a set"}>
        <FlashcardSetCreator activeGroupId={activeGroupId} />
      </FloatingCreateAction>

      {/* Bottom: Sets */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">{L.your}</h2>
          <div className="text-xs opacity-70">{all.length}</div>
        </div>

        <div className="mt-4">
          <VisibilityTabs
            basePath="/flashcards"
            currentQuery={currentQuery}
            active={(scope as any)}
            labels={{ private: L.private, shared: L.shared, public: L.public }}
            counts={{ private: priv.length, shared: shared.length, public: pub.length }}
          />
        </div>

        {/* Search (tags removed to simplify the UX) */}
        <form className="mt-4 flex flex-wrap items-center gap-2" action="/flashcards" method="get">
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
    </div>
  );
}
