import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/core";
import { ContentDetailHeader } from "@/components/ContentDetailHeader";
import { ContentItemSettings } from "@/components/ContentItemSettings";
import { AdminOfficialControls } from "@/components/AdminOfficialControls";
import { AdminTranslationsPanel } from "@/components/AdminTranslationsPanel";
import { fetchFoldersWithAncestors, buildFolderPathMap } from "@/lib/content/folders";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ExerciseSetPage({ params }: PageProps) {
  const { id } = await params;

  const locale = await getLocale();
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  const { data: isAdminData } = await supabase.rpc("is_app_admin");
  const isAdmin = Boolean(isAdminData);

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-5xl overflow-x-hidden">
        <h1 className="text-2xl font-semibold">{t(locale, "auth.login")}</h1>
      </div>
    );
  }

  const { data: set } = await supabase
    .from("exercise_sets")
    .select("id,title,owner_id,visibility,folder_id,is_official,official_published,difficulty,published_at,library_folders(id,name,parent_id)")
    .eq("id", id)
    .maybeSingle();

  if (!set) {
    return (
      <div className="mx-auto w-full max-w-5xl overflow-x-hidden">
        <h1 className="text-2xl font-semibold">{t(locale, "exercises.notFound")}</h1>
        <p className="mt-2 text-sm opacity-70">{t(locale, "exercises.notFoundDesc")}</p>
      </div>
    );
  }

  const rootLabel = t(locale, "folders.none");
  const folderId = (set as any)?.folder_id ?? null;
  let folderName: string | null = (set as any)?.library_folders?.name ?? null;

  if (folderId) {
    const rows = await fetchFoldersWithAncestors(supabase as any, [folderId]);
    const paths = buildFolderPathMap(rows, rootLabel);
    folderName = paths.get(folderId) ?? folderName;
  }

  const isOwner = (set as any).owner_id === user.id;
  const isOfficial = Boolean((set as any).is_official);

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_group_id")
    .eq("id", user.id)
    .maybeSingle();

  const activeGroupId = (profile as any)?.active_group_id ?? null;

  let sharedGroupIds: string[] = [];
  if (isOwner || isAdmin) {
    const { data: shares } = await supabase.from("exercise_set_shares").select("group_id").eq("set_id", (set as any).id);
    sharedGroupIds = (shares ?? []).map((s: any) => s.group_id).filter(Boolean);
  }

  // Localize official content (EN): best-effort translation layer.
  let displayTitle: string = String((set as any).title ?? "(set)");
  if (locale === "en") {
    const { data: setTr } = await supabase
      .from("content_translations")
      .select("payload")
      .eq("content_type", "exercise_set")
      .eq("content_id", (set as any).id)
      .eq("lang", "en")
      .maybeSingle();
    const p = (setTr as any)?.payload as any;
    if (p?.title) displayTitle = String(p.title);
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 overflow-x-hidden">
      <ContentDetailHeader
        backHref="/exercises"
        backLabel={t(locale, "nav.exercises")}
        title={displayTitle}
        visibility={(set as any).visibility}
        folderName={folderName}
      />

      {/* Practice first: keep the learning flow immediate. */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">{locale === "fr" ? "Exercices" : "Exercises"}</div>
            <div className="mt-1 text-xs opacity-70">
              {locale === "fr" ? "Mode entraînement (bientôt)." : "Training mode (coming soon)."}
            </div>
          </div>
          <button type="button" className="btn btn-secondary" disabled>
            {locale === "fr" ? "Commencer" : "Start"}
          </button>
        </div>

        <div className="mt-3 text-sm opacity-80">
          {locale === "fr"
            ? "Le moteur d’exercices (énoncés, étapes, solutions) arrive bientôt. En attendant, tu peux déjà créer, classer et partager des sets d’exercices."
            : "The exercises engine (statements, steps, solutions) is coming soon. For now you can already create, organize and share exercise sets."}
        </div>
      </div>

      {(isAdmin || (isOwner && !isOfficial)) || isAdmin ? (
        <details className="rounded-2xl border border-white/10 bg-neutral-950/40 p-4">
          <summary className="cursor-pointer select-none font-semibold">
            {t(locale, "common.settings")}
            <span className="ml-2 text-xs opacity-70">
              {locale === "fr" ? "(organisation, visibilité, publication)" : "(organization, visibility, publishing)"}
            </span>
          </summary>

          <div className="mt-4 grid gap-4">
            {isAdmin || (isOwner && !isOfficial) ? (
              <ContentItemSettings
                title={t(locale, "common.settings")}
                subtitle={
                  locale === "fr" ? "Renommer, classer et gérer la visibilité." : "Rename, organize and manage visibility."
                }
                itemId={(set as any).id}
                table="exercise_sets"
                visibility={(set as any).visibility}
                folderId={(set as any).folder_id ?? null}
                folderKind="exercises"
                shareTable="exercise_set_shares"
                shareFk="set_id"
                rootLabel={locale === "fr" ? "Sans dossier" : "No folder"}
                activeGroupId={activeGroupId}
                initialSharedGroupIds={sharedGroupIds}
              />
            ) : null}

            {isAdmin ? (
              <AdminOfficialControls
                table="exercise_sets"
                itemId={(set as any).id}
                shareTable="exercise_set_shares"
                shareFk="set_id"
                initial={{
                  is_official: Boolean((set as any).is_official),
                  official_published: Boolean((set as any).official_published),
                  difficulty: (set as any).difficulty ?? 1,
                  published_at: (set as any).published_at ?? null,
                  visibility: (set as any).visibility ?? null
                }}
              />
            ) : null}

            {isAdmin && isOfficial ? (
              <AdminTranslationsPanel
                kind="exercise"
                setId={String((set as any).id)}
                baseTitle={String((set as any).title ?? "(set)")}
              />
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
