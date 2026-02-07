import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/core";
import { ContentDetailHeader } from "@/components/ContentDetailHeader";
import { ContentItemSettings } from "@/components/ContentItemSettings";
import { DocumentActions } from "@/components/DocumentActions";
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

async function hasAnyShareRowForDoc(supabase: any, docId: string) {
  // RLS: members will only see shares for groups they're in; owners see all.
  const { data } = await supabase.from("document_shares").select("group_id").eq("document_id", docId).limit(1);
  return (data?.length ?? 0) > 0;
}

export default async function DocumentPage({ params }: PageProps) {
  const { id } = await params;

  const locale = await getLocale();
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-2xl font-semibold">{t(locale, "auth.login")}</h1>
      </div>
    );
  }

  const { data: doc } = await supabase
    .from("documents")
    .select("id,title,external_url,preview_url,created_at,visibility,folder_id,group_id,owner_id,library_folders(id,name,parent_id)")
    .eq("id", id)
    .maybeSingle();

  if (!doc) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-2xl font-semibold">{t(locale, "library.empty")}</h1>
      </div>
    );
  }

  const rootLabel = t(locale, "folders.none");
  const folderId = (doc as any)?.folder_id ?? null;
  let folderName: string | null = (doc as any)?.library_folders?.name ?? null;
  if (folderId) {
    const rows = await fetchFoldersWithAncestors(supabase as any, [folderId]);
    const paths = buildFolderPathMap(rows, rootLabel);
    folderName = paths.get(folderId) ?? folderName;
  }
  const isOwner = (doc as any).owner_id === user.id;

  const visibility = String((doc as any).visibility ?? "private");
  const isGroups = visibility === "group" || visibility === "groups";

  const legacyMember = await isMemberOfGroup(supabase, user.id, (doc as any).group_id ?? null);
  const sharedMember = await hasAnyShareRowForDoc(supabase, (doc as any).id);

  // per your rules:
  // private -> owner only
  // public -> creator (owner) only
  // groups/group -> member OR owner
  const canEditDoc = isOwner || (isGroups && (legacyMember || sharedMember));

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_group_id")
    .eq("id", user.id)
    .maybeSingle();

  const activeGroupId = (profile as any)?.active_group_id ?? null;

  let sharedGroupIds: string[] = [];
  if (isOwner) {
    const { data: shares } = await supabase.from("document_shares").select("group_id").eq("document_id", (doc as any).id);
    sharedGroupIds = (shares ?? []).map((s: any) => s.group_id).filter(Boolean);
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <ContentDetailHeader
        backHref="/library"
        backLabel={t(locale, "nav.library")}
        title={(doc as any).title}
        visibility={(doc as any).visibility}
        folderName={folderName}
        rightSlot={
          (doc as any).external_url ? (
            <a
              className="btn btn-secondary w-full whitespace-nowrap sm:w-auto"
              href={(doc as any).external_url}
              target="_blank"
              rel="noreferrer"
            >
              {t(locale, "library.openInNewTab")}
            </a>
          ) : null
        }
      />

      <div className="card p-4">
        {(doc as any).preview_url ? (
          <iframe
            title={(doc as any).title}
            src={(doc as any).preview_url}
            className="h-[70vh] w-full rounded-xl border border-white/10 bg-black/20"
            allow="autoplay"
          />
        ) : (
          <div className="text-sm opacity-80">{t(locale, "library.previewUnavailable")}</div>
        )}
      </div>

      {/* For non-owners who still can edit/delete (groups), show safe actions (no share sync) */}
      {canEditDoc && !isOwner ? (
        <div>
          <DocumentActions
            documentId={(doc as any).id}
            initialTitle={(doc as any).title}
            initialExternalUrl={(doc as any).external_url ?? ""}
            initialPreviewUrl={(doc as any).preview_url ?? ""}
            afterDeleteRedirect="/library"
          />
        </div>
      ) : null}

      {/* Keep full settings owner-only (shares sync + visibility changes) */}
      {isOwner ? (
        <div>
                    <ContentItemSettings
            title={t(locale, "common.settings")}
            subtitle={
              locale === "fr" ? "Renommer, classer et gérer la visibilité." : "Rename, organize and manage visibility."
            }
            itemId={(doc as any).id}
            table="documents"
            visibility={(doc as any).visibility}
            folderId={(doc as any).folder_id ?? null}
            folderKind="documents"
            shareTable="document_shares"
            shareFk="document_id"
            rootLabel={locale === "fr" ? "Sans dossier" : "No folder"}
            activeGroupId={activeGroupId}
            initialSharedGroupIds={sharedGroupIds}
            legacyGroupId={(doc as any).group_id ?? null}
          />
        </div>
      ) : null}
    </div>
  );
}