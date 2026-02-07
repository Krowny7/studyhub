"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { useI18n } from "@/components/I18nProvider";
import { FolderSettings } from "@/components/FolderSettings";
import type { FolderRow } from "@/components/FolderDriveView";

export function FolderActions({
  folder,
  folders,
  kind,
  itemTable,
  directChildCount,
  directItemCount,
  onChanged
}: {
  folder: FolderRow;
  folders: FolderRow[];
  kind: "documents" | "flashcards" | "quizzes" | "exercises";
  itemTable: "documents" | "flashcard_sets" | "quiz_sets" | "exercise_sets";
  directChildCount: number;
  directItemCount: number;
  onChanged?: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost h-9 w-9 !rounded-full p-0 opacity-70 hover:opacity-100"
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
        <FolderSettings
          kind={kind}
          itemTable={itemTable}
          folder={folder}
          folders={folders}
          directChildCount={directChildCount}
          directItemCount={directItemCount}
          onUpdated={() => {
            setOpen(false);
            onChanged?.();
          }}
          onDeleted={() => {
            setOpen(false);
            onChanged?.();
          }}
        />
      </Modal>
    </>
  );
}
