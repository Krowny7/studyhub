"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";
import { GroupMultiPicker } from "@/components/GroupMultiPicker";
import { FolderPicker } from "@/components/FolderPicker";
import { AdvancedSection } from "@/components/AdvancedSection";

type ShareMode = "private" | "public" | "groups";

export function QuizSetCreator({ activeGroupId, isAdmin = false }: { activeGroupId: string | null; isAdmin?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useI18n();

  const [title, setTitle] = useState("");
  const [shareMode, setShareMode] = useState<ShareMode>("private");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [isOfficial, setIsOfficial] = useState(false);
  const [officialPublished, setOfficialPublished] = useState(true);
  const [difficulty, setDifficulty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="grid gap-3">
      <input
        className="input"
        placeholder={t("qcm.setTitlePlaceholder")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      {/* Keep the default flow minimal: title + folder */}
      <FolderPicker kind="quizzes" value={folderId} onChange={setFolderId} compact={true} />

      {/* Everything else is optional (scales better as features grow). */}
      <AdvancedSection label={t("common.advanced")}>
        <div className="grid gap-3">
          {isAdmin ? (
            <div className="card-soft p-4">
              <div className="text-sm font-medium">{t("qcm.referenceTitle")}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`chip ${isOfficial ? "chip-active" : ""}`}
                  onClick={() => setIsOfficial((v) => !v)}
                >
                  {isOfficial ? (t("qcm.referenceTitle")) : (t("qcm.makeReference") ?? "Référencé")}
                </button>

                {isOfficial ? (
                  <button
                    type="button"
                    className={`chip ${officialPublished ? "chip-active" : ""}`}
                    onClick={() => setOfficialPublished((v) => !v)}
                  >
                    {officialPublished ? (t("qcm.published") ?? "Publié") : (t("qcm.draft") ?? "Brouillon")}
                  </button>
                ) : null}
              </div>

              {isOfficial ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="text-xs opacity-70">{t("qcm.difficulty") ?? "Difficulté"}</div>
                  <select
                    className="input sm:w-40"
                    value={difficulty}
                    onChange={(e) => setDifficulty(Number(e.target.value))}
                  >
                    <option value={1}>1 — Easy</option>
                    <option value={2}>2 — Medium</option>
                    <option value={3}>3 — Hard</option>
                  </select>
                  <div className="text-xs opacity-60">
                    {t("qcm.referenceAdminHint") ??
                    "Les QCM référencés sont publics, éditables uniquement par les admins, et peuvent donner de l'XP."}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {!isOfficial ? (
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
          ) : null}
        </div>
      </AdvancedSection>

      <button
        className="btn btn-primary"
        disabled={busy || !title.trim() || (!isOfficial && shareMode === "groups" && groupIds.length === 0)}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const { data: auth } = await supabase.auth.getUser();
            if (!auth.user) throw new Error("Not logged in");

            const visibility = isOfficial ? "public" : shareMode === "groups" ? "groups" : shareMode;

            const nowIso = new Date().toISOString();

            const res = await supabase
              .from("quiz_sets")
              .insert({
                title: title.trim(),
                visibility,
                group_id: null,
                folder_id: folderId,
                owner_id: auth.user.id,
                is_official: isOfficial,
                official_published: isOfficial ? officialPublished : false,
                difficulty: isOfficial ? difficulty : 1,
                published_at: isOfficial && officialPublished ? nowIso : null
              })
              .select("id")
              .maybeSingle();

            if (res.error) throw res.error;
            const setId = (res.data as any)?.id as string | undefined;

            if (!isOfficial && shareMode === "groups" && setId) {
              const rows = groupIds.map((gid) => ({ set_id: setId, group_id: gid }));
              const share = await supabase.from("quiz_set_shares").insert(rows);
              if (share.error) throw share.error;
            }

            setTitle("");
            setShareMode("private");
            setGroupIds([]);
            setFolderId(null);
            setIsOfficial(false);
            setOfficialPublished(true);
            setDifficulty(1);
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
        {busy ? t("common.saving") : t("qcm.create")}
      </button>

      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}
