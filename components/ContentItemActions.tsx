"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ContentItemSettings } from "@/components/ContentItemSettings";
import { useI18n } from "@/components/I18nProvider";
import type { FolderKind } from "@/components/FolderPicker";

export function ContentItemActions({
  title,
  itemId,
  table,
  visibility,
  folderId,
  folderKind,
  shareTable,
  shareFk,
  rootLabel,
  activeGroupId,
  subtitle
}: {
  title: string;
  itemId: string;
  table: "documents" | "flashcard_sets" | "quiz_sets" | "exercise_sets";
  visibility: string | null;
  folderId: string | null;
  folderKind: FolderKind;
  shareTable: "document_shares" | "flashcard_set_shares" | "quiz_set_shares" | "exercise_set_shares";
  shareFk: "document_id" | "set_id";
  rootLabel: string;
  activeGroupId: string | null;
  subtitle?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost h-9 w-9 !rounded-full p-0 opacity-80 hover:opacity-100"
        title={t("common.settings")}
        aria-label={t("common.settings")}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        ⋯
      </button>

      <Modal open={open} title={t("common.settings")} onClose={() => setOpen(false)} maxWidthClass="max-w-2xl">
        <ContentItemSettings
          title={title}
          subtitle={subtitle ?? ""}
          itemId={itemId}
          table={table}
          visibility={visibility}
          folderId={folderId}
          folderKind={folderKind}
          shareTable={shareTable}
          shareFk={shareFk}
          rootLabel={rootLabel}
          activeGroupId={activeGroupId}
          compact={true}
          onUpdated={() => {
            // close after save (keeps the flow fast); data refresh is handled inside settings
            setOpen(false);
          }}
          onDeleted={() => {
            setOpen(false);
          }}
        />
      </Modal>
    </>
  );
}
