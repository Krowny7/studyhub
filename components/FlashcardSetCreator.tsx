"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";
import { GroupMultiPicker } from "@/components/GroupMultiPicker";
import { FolderPicker } from "@/components/FolderPicker";
import { AdvancedSection } from "@/components/AdvancedSection";

type ShareMode = "private" | "public" | "groups";

export function FlashcardSetCreator({ activeGroupId }: { activeGroupId: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useI18n();

  const [title, setTitle] = useState("");
  const [shareMode, setShareMode] = useState<ShareMode>("private");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="grid gap-3">
      <input
        className="input"
        placeholder={t("flashcards.setTitlePlaceholder")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      {/* Minimal by default: title + folder */}
      <FolderPicker kind="flashcards" value={folderId} onChange={setFolderId} compact={true} />

      <AdvancedSection label={t("common.advanced")}>
        <div className="grid gap-3">
          <div className="card-soft p-4">
            <div className="text-sm font-medium">{t("sharing.title")}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className={`chip ${shareMode === "private" ? "chip-active" : ""}`}
                onClick={() => setShareMode("private")}
              >
                {t("common.private")}
              </button>
              <button
                type="button"
                className={`chip ${shareMode === "groups" ? "chip-active" : ""}`}
                onClick={() => setShareMode("groups")}
              >
                {t("sharing.someGroups")}
              </button>
              <button
                type="button"
                className={`chip ${shareMode === "public" ? "chip-active" : ""}`}
                onClick={() => setShareMode("public")}
              >
                {t("common.public")}
              </button>
            </div>
            {shareMode === "groups" && (
              <div className="mt-3">
                <GroupMultiPicker value={groupIds} onChange={setGroupIds} defaultSelectGroupId={activeGroupId} />
              </div>
            )}
          </div>
        </div>
      </AdvancedSection>

      <button
        className="btn btn-primary"
        disabled={busy || !title.trim() || (shareMode === "groups" && groupIds.length === 0)}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const { data: auth } = await supabase.auth.getUser();
            if (!auth.user) throw new Error("Not logged in");

            const visibility = shareMode === "groups" ? "groups" : shareMode;

            const res = await supabase
              .from("flashcard_sets")
              .insert({
                title: title.trim(),
                visibility,
                group_id: null,
                folder_id: folderId,
                owner_id: auth.user.id
              })
              .select("id")
              .maybeSingle();

            if (res.error) throw res.error;
            const setId = (res.data as any)?.id as string | undefined;

            if (shareMode === "groups" && setId) {
              const rows = groupIds.map((gid) => ({ set_id: setId, group_id: gid }));
              const share = await supabase.from("flashcard_set_shares").insert(rows);
              if (share.error) throw share.error;
            }

            setTitle("");
            setShareMode("private");
            setGroupIds([]);
            setFolderId(null);
            setMsg("✅");
            window.location.reload();
          } catch (e: any) {
            setMsg(`❌ ${e?.message ?? t("common.error")}`);
          } finally {
            setBusy(false);
          }
        }}
        type="button"
      >
        {busy ? t("common.saving") : t("flashcards.create")}
      </button>

      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}
