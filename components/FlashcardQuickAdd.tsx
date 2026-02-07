"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";
import { ImageInsertButton } from "@/components/ImageInsertButton";

function appendTag(prev: string, tag: string) {
  const p = (prev ?? "").toString();
  if (!p.trim()) return tag;
  // Ensure tag goes on its own line for predictable rendering.
  const endsWithNl = p.endsWith("\n");
  return p + (endsWithNl ? "" : "\n") + tag;
}

export function FlashcardQuickAdd({ setId, nextPosition }: { setId: string; nextPosition: number }) {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useI18n();

  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="w-full min-w-0 max-w-full rounded-2xl border p-4">
      <h3 className="font-semibold">{t("flashcards.quickAddTitle")}</h3>

      {/* Mobile-first: one column, everything full width (prevents iOS clipping / horizontal overflow). */}
      <div className="mt-3 grid w-full min-w-0 gap-2">
        <div className="grid gap-2">
          <textarea
            className="box-border h-24 w-full min-w-0 max-w-full rounded-xl border bg-transparent p-3 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
            placeholder={t("flashcards.frontPlaceholder")}
            value={front}
            onChange={(e) => setFront(e.target.value)}
          />
          <div className="flex items-center justify-end">
            <ImageInsertButton onInsert={(tag) => setFront((p) => appendTag(p, tag))} />
          </div>
        </div>

        <div className="grid gap-2">
          <textarea
            className="box-border h-24 w-full min-w-0 max-w-full rounded-xl border bg-transparent p-3 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
            placeholder={t("flashcards.backPlaceholder")}
            value={back}
            onChange={(e) => setBack(e.target.value)}
          />
          <div className="flex items-center justify-end">
            <ImageInsertButton onInsert={(tag) => setBack((p) => appendTag(p, tag))} />
          </div>
        </div>

        <button
          className="box-border w-full rounded-lg bg-white px-4 py-2 text-center text-sm font-medium text-black whitespace-normal disabled:opacity-50 sm:w-auto sm:justify-self-start"
          disabled={busy || !front.trim() || !back.trim()}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            try {
              const ins = await supabase.from("flashcards").insert({
                set_id: setId,
                front: front.trim(),
                back: back.trim(),
                position: nextPosition
              });
              if (ins.error) throw ins.error;
              setFront("");
              setBack("");
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
          {busy ? t("common.saving") : t("flashcards.addCard")}
        </button>

        {msg && <div className="text-sm break-words [overflow-wrap:anywhere]">{msg}</div>}
      </div>
    </div>
  );
}
