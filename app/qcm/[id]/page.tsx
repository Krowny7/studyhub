import { createClient } from "@/lib/supabase/server";
import { QuizSetView } from "@/components/QuizSetView";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/core";
import { ContentDetailHeader } from "@/components/ContentDetailHeader";
import { ContentItemSettings } from "@/components/ContentItemSettings";
import { AdminOfficialControls } from "@/components/AdminOfficialControls";
import { PvpInviteButton } from "@/components/PvpInviteButton";
import { AdminTranslationsPanel } from "@/components/AdminTranslationsPanel";
import { fetchFoldersWithAncestors, buildFolderPathMap } from "@/lib/content/folders";

type PageProps = {
  params: Promise<{ id: string }>;
};

async function isMemberOfGroup(supabase: any, userId: string, groupId: string | null) {
  if (!groupId) return false;
  const { data } = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function hasAnyShareRowForSet(supabase: any, setId: string) {
  // RLS: members will only see shares for groups they're in; owners see all.
  const { data } = await supabase.from("quiz_set_shares").select("group_id").eq("set_id", setId).limit(1);
  return (data?.length ?? 0) > 0;
}

export default async function QuizSetPage({ params }: PageProps) {
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
    .from("quiz_sets")
    .select("id,title,owner_id,visibility,folder_id,group_id,is_official,official_published,difficulty,published_at,library_folders(id,name,parent_id)")
    .eq("id", id)
    .maybeSingle();

  if (!set) {
    return (
      <div className="mx-auto w-full max-w-5xl overflow-x-hidden">
        <h1 className="text-2xl font-semibold">{t(locale, "qcm.notFound")}</h1>
        <p className="mt-2 text-sm opacity-70">{t(locale, "qcm.notFoundDesc")}</p>
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
  const isPublished = Boolean((set as any).official_published);
  const canChallenge = isOfficial && isPublished;

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_group_id")
    .eq("id", user.id)
    .maybeSingle();

  const activeGroupId = (profile as any)?.active_group_id ?? null;

  // --- Permissions per your rules:
  // private: owner only
  // public: creator (owner) only
  // groups/group: member OR owner
  const visibility = String((set as any).visibility ?? "private");
  const legacyMember = await isMemberOfGroup(supabase, user.id, (set as any).group_id ?? null);
  const sharedMember = await hasAnyShareRowForSet(supabase, (set as any).id);

  const isGroups = visibility === "group" || visibility === "groups";
  const canEditQuestions = isOfficial ? isAdmin : (isOwner || (isGroups && (legacyMember || sharedMember)));

  // settings panel: keep OWNER-ONLY (avoid share-sync issues for non-owner)
  let sharedGroupIds: string[] = [];
  if (isOwner || isAdmin) {
    const { data: shares } = await supabase.from("quiz_set_shares").select("group_id").eq("set_id", (set as any).id);
    sharedGroupIds = (shares ?? []).map((s: any) => s.group_id).filter(Boolean);
  }

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id,prompt,choices,correct_index,explanation,position")
    .eq("set_id", (set as any).id)
    .order("position", { ascending: true });

  const initialQuestions = (questions ?? []).map((q: any) => ({
    ...q,
    choices: Array.isArray(q.choices) ? q.choices : []
  }));

  // Localize official content (EN): best-effort translation layer.
  let displayTitle: string = String((set as any).title ?? "(quiz)");
  let localizedQuestions: any[] = initialQuestions as any[];

  if (locale === "en" && (questions?.length ?? 0) > 0) {
    // Set title
    const { data: setTr } = await supabase
      .from("content_translations")
      .select("payload")
      .eq("content_type", "quiz_set")
      .eq("content_id", (set as any).id)
      .eq("lang", "en")
      .maybeSingle();
    const sp = (setTr as any)?.payload as any;
    if (sp?.title) displayTitle = String(sp.title);

    // Questions
    const ids = (questions ?? []).map((q: any) => String(q.id));
    const chunkSize = 500;
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += chunkSize) chunks.push(ids.slice(i, i + chunkSize));

    const trRows: any[] = [];
    for (const chunk of chunks) {
      const { data } = await supabase
        .from("content_translations")
        .select("content_id,payload")
        .eq("content_type", "quiz_question")
        .eq("lang", "en")
        .in("content_id", chunk);
      if (data?.length) trRows.push(...(data as any[]));
    }

    const trById = new Map<string, any>();
    (trRows ?? []).forEach((r: any) => trById.set(String(r.content_id), r.payload));

    localizedQuestions = (initialQuestions as any[]).map((q: any) => {
      const tr = trById.get(String(q.id));
      if (!tr) return q;
      return {
        ...q,
        prompt: tr?.prompt ? String(tr.prompt) : q.prompt,
        choices: Array.isArray(tr?.choices) ? tr.choices : q.choices,
        explanation: tr?.explanation != null ? String(tr.explanation) : q.explanation
      };
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 overflow-x-hidden">
      <ContentDetailHeader
        backHref="/qcm"
        backLabel={t(locale, "nav.qcm")}
        title={displayTitle}
        visibility={(set as any).visibility}
        folderName={folderName}
        rightSlot={canChallenge ? <PvpInviteButton quizSetId={String((set as any).id)} /> : null}
      />

      {/* Study first: the main runner is always immediately available. */}
      <QuizSetView setId={(set as any).id} isOwner={canEditQuestions} initialQuestions={localizedQuestions as any} />

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
                table="quiz_sets"
                visibility={(set as any).visibility}
                folderId={(set as any).folder_id ?? null}
                folderKind="quizzes"
                shareTable="quiz_set_shares"
                shareFk="set_id"
                rootLabel={locale === "fr" ? "Sans dossier" : "No folder"}
                activeGroupId={activeGroupId}
                initialSharedGroupIds={sharedGroupIds}
                legacyGroupId={(set as any).group_id ?? null}
              />
            ) : null}

            {isAdmin ? (
              <AdminOfficialControls
                table="quiz_sets"
                itemId={(set as any).id}
                shareTable="quiz_set_shares"
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
                kind="quiz"
                setId={String((set as any).id)}
                baseTitle={String((set as any).title ?? "(quiz)")}
                questions={initialQuestions.map((q: any) => ({
                  id: String(q.id),
                  prompt: String(q.prompt ?? ""),
                  choices: Array.isArray(q.choices) ? q.choices : [],
                  explanation: q.explanation ?? null
                }))}
              />
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}