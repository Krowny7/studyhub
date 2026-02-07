"use client";

import Link from "next/link";
import { VisibilityBadge } from "@/components/ContentFolderBlocks";
import { normalizeVisibility } from "@/lib/content/visibility";
import { ContentItemActions } from "@/components/ContentItemActions";
import type { FolderKind } from "@/components/FolderPicker";

type ActionsConfig = {
  table: "documents" | "flashcard_sets" | "quiz_sets" | "exercise_sets";
  visibility: string | null;
  folderId: string | null;
  folderKind: FolderKind;
  shareTable: "document_shares" | "flashcard_set_shares" | "quiz_set_shares" | "exercise_set_shares";
  shareFk: "document_id" | "set_id";
  activeGroupId: string | null;
  subtitle?: string;
};

export function ContentItemCard({
  itemId,
  href,
  title,
  visibility,
  folderLabel,
  rootLabel,
  actions
}: {
  itemId: string;
  href: string;
  title: string;
  visibility: string | null;
  folderLabel: string;
  rootLabel: string;
  actions?: ActionsConfig;
}) {
  const vis = normalizeVisibility(visibility);

  // If we render the actions kebab (top-right, outside the <Link>), reserve
  // horizontal space so card content never sits underneath it.
  const linkCls = actions ? "block pr-10" : "block";

  return (
    <div className="card-soft group relative p-4 transition hover:bg-white/[0.06]">
      <Link href={href} className={linkCls}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{title}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <VisibilityBadge visibility={vis} />
              {folderLabel !== rootLabel ? <span className="truncate text-xs opacity-60">{folderLabel}</span> : null}
            </div>
          </div>
          {/* No "Open →" label: the whole card is clickable. */}
        </div>
      </Link>

      {actions ? (
        <div className="absolute right-2 top-2 z-10">
          <ContentItemActions
            title={title}
            itemId={itemId}
            table={actions.table}
            visibility={actions.visibility}
            folderId={actions.folderId}
            folderKind={actions.folderKind}
            shareTable={actions.shareTable}
            shareFk={actions.shareFk}
            rootLabel={rootLabel}
            activeGroupId={actions.activeGroupId}
            subtitle={actions.subtitle}
          />
        </div>
      ) : null}
    </div>
  );
}
