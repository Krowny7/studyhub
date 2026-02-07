"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";

type TableName = "quiz_sets" | "exercise_sets";
type ShareTableName = "quiz_set_shares" | "exercise_set_shares";

export function AdminOfficialControls({
  table,
  itemId,
  initial,
  shareTable,
  shareFk
}: {
  table: TableName;
  itemId: string;
  initial: {
    is_official: boolean;
    official_published: boolean;
    difficulty: number | null;
    published_at: string | null;
    visibility: string | null;
  };
  shareTable: ShareTableName;
  shareFk: "set_id";
}) {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useI18n();

  const [isOfficial, setIsOfficial] = useState(Boolean(initial.is_official));
  const [published, setPublished] = useState(Boolean(initial.official_published));
  const [difficulty, setDifficulty] = useState(Number(initial.difficulty ?? 1) || 1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(next: { isOfficial: boolean; published: boolean; difficulty: number }) {
    setBusy(true);
    setMsg(null);
    try {
      const nowIso = new Date().toISOString();

      const patch: any = {
        is_official: next.isOfficial,
        official_published: next.isOfficial ? next.published : false,
        difficulty: next.isOfficial ? next.difficulty : 1,
        published_at: next.isOfficial && next.published ? nowIso : null
      };

      // Promote to public when it becomes official.
      if (next.isOfficial) patch.visibility = "public";

      const upd = await supabase.from(table).update(patch).eq("id", itemId);
      if (upd.error) throw upd.error;

      // Reference content should not have group shares.
      if (next.isOfficial) {
        const delShares = await supabase.from(shareTable).delete().eq(shareFk, itemId);
        // ignore errors (e.g. RLS prevents reading; delete policy should allow admin)
        if (delShares.error) {
          // only show info, don't fail
          console.warn(delShares.error);
        }
      }

      setIsOfficial(next.isOfficial);
      setPublished(next.published);
      setDifficulty(next.difficulty);
      setMsg("✅");
      window.location.reload();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-semibold">Admin • Référencé</div>
          <div className="mt-1 text-xs opacity-70">
            Promouvoir / retirer un contenu de la liste “référence”. Un contenu référencé est public et éditable
            uniquement par les admins.
          </div>
        </div>
        <div className="text-xs opacity-70">{busy ? t("common.saving") : ""}</div>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`chip ${isOfficial ? "chip-active" : ""}`}
            disabled={busy}
            onClick={() => save({ isOfficial: !isOfficial, published, difficulty })}
          >
            {isOfficial ? "Référencé" : "Basique"}
          </button>

          {isOfficial ? (
            <button
              type="button"
              className={`chip ${published ? "chip-active" : ""}`}
              disabled={busy}
              onClick={() => save({ isOfficial, published: !published, difficulty })}
            >
              {published ? "Publié" : "Brouillon"}
            </button>
          ) : null}
        </div>

        {isOfficial ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="text-xs opacity-70">Difficulté</div>
            <select
              className="input sm:w-40"
              disabled={busy}
              value={difficulty}
              onChange={(e) => {
                const next = Number(e.target.value);
                setDifficulty(next);
              }}
            >
              <option value={1}>1 — Easy</option>
              <option value={2}>2 — Medium</option>
              <option value={3}>3 — Hard</option>
            </select>
            <button
              type="button"
              className="btn btn-secondary sm:w-auto"
              disabled={busy}
              onClick={() => save({ isOfficial, published, difficulty })}
            >
              Enregistrer
            </button>
          </div>
        ) : null}

        {msg ? <div className="text-sm">{msg}</div> : null}
      </div>
    </div>
  );
}
