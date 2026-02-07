"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { Modal } from "@/components/Modal";
import { TagMultiSelect, type TagRow } from "@/components/TagMultiSelect";
import { useI18n } from "@/components/I18nProvider";

type RelationConfig = {
  table: "document_tags" | "flashcard_set_tags" | "quiz_set_tags";
  itemColumn: "document_id" | "set_id" | "quiz_set_id";
};

export function EditTagsAction({
  itemId,
  allTags,
  initial,
  relation
}: {
  itemId: string;
  allTags: TagRow[];
  initial: string[];
  relation: RelationConfig;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Keep local state in sync if the parent list refreshes.
  // (We do a simple reset on open.)
  function onOpen() {
    setValue(initial);
    setMsg(null);
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const cleaned = value.filter((x) => x && x !== "__none");
      // Replace relations (simple + robust)
      const del = await supabase.from(relation.table).delete().eq(relation.itemColumn, itemId);
      if (del.error) throw del.error;

      if (cleaned.length) {
        const rows = cleaned.map((tag_id) => ({
          tag_id,
          [relation.itemColumn]: itemId
        }));
        const ins = await supabase.from(relation.table).insert(rows);
        if (ins.error) throw ins.error;
      }

      setMsg("✅");
      // Simple refresh strategy (keeps server components in sync)
      window.location.reload();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost h-9 w-9 !rounded-full p-0 opacity-80 hover:opacity-100"
        title={t("tags.edit")}
        aria-label={t("tags.edit")}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpen();
        }}
      >
        🏷️
      </button>

      <Modal open={open} title={t("tags.editTitle")} onClose={() => setOpen(false)} maxWidthClass="max-w-xl">
        <div className="grid gap-3">
          <TagMultiSelect
            tags={allTags}
            value={value}
            onChange={setValue}
            allowCreate={true}
            label={t("tags.title")}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={save}>
              {busy ? t("common.saving") : t("common.save")}
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </button>
          </div>
          {msg ? <div className="text-sm">{msg}</div> : null}
        </div>
      </Modal>
    </>
  );
}
