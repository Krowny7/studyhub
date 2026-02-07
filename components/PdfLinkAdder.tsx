"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";
import { GroupMultiPicker } from "@/components/GroupMultiPicker";
import { FolderPicker } from "@/components/FolderPicker";
import { AdvancedSection } from "@/components/AdvancedSection";

type ShareMode = "private" | "public" | "groups";

function normalizeDrivePreview(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("drive.google.com")) {
      const m = u.pathname.match(/\/file\/d\/([^/]+)\//);
      if (m?.[1]) return `https://drive.google.com/file/d/${m[1]}/preview`;
      const id = u.searchParams.get("id");
      if (id) return `https://drive.google.com/file/d/${id}/preview`;
    }
    return null;
  } catch {
    return null;
  }
}

export function PdfLinkAdder({ activeGroupId }: { activeGroupId: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useI18n();

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const [shareMode, setShareMode] = useState<ShareMode>("private");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="grid gap-3">
      <p className="text-sm text-white/80">{t("library.addSubtitle")}</p>

      <input
        className="input"
        placeholder={t("library.titlePlaceholder")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <input
        className="input"
        placeholder={t("library.urlPlaceholder")}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />

      {/* Minimal by default: choose a folder. */}
      <FolderPicker kind="documents" value={folderId} onChange={setFolderId} compact={true} />

      {/* Optional knobs hidden behind a disclosure to keep the flow clean. */}
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
        disabled={busy || !title.trim() || !url.trim() || (shareMode === "groups" && groupIds.length === 0)}
        onClick={async () => {
          setMsg(null);
          setBusy(true);
          try {
            const { data: auth } = await supabase.auth.getUser();
            const user = auth.user;
            if (!user) throw new Error("Not logged in");

            let parsed: URL;
            try {
              parsed = new URL(url.trim());
            } catch {
              throw new Error("Invalid URL.");
            }

            const drivePreview = normalizeDrivePreview(parsed.toString());
            const visibility = shareMode === "groups" ? "groups" : shareMode;

            const insert = await supabase
              .from("documents")
              .insert({
                title: title.trim(),
                external_url: parsed.toString(),
                preview_url: drivePreview,
                visibility,
                group_id: null,
                folder_id: folderId,
                owner_id: user.id
              })
              .select("id")
              .maybeSingle();

            if (insert.error) throw insert.error;
            const docId = (insert.data as any)?.id;

            if (shareMode === "groups" && docId) {
              const rows = groupIds.map((gid) => ({ document_id: docId, group_id: gid }));
              const share = await supabase.from("document_shares").insert(rows);
              if (share.error) throw share.error;
            }

            setTitle("");
            setUrl("");
            setShareMode("private");
            setGroupIds([]);
            setFolderId(null);
            setMsg(t("library.added"));
            window.location.reload();
          } catch (e: any) {
            setMsg(`❌ ${e?.message ?? t("common.error")}`);
          } finally {
            setBusy(false);
          }
        }}
        type="button"
      >
        {busy ? t("library.saving") : t("library.saveLink")}
      </button>

      <div className="text-xs text-white/70">{t("library.advice")}</div>

      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}
