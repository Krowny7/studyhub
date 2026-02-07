"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";

type Props = {
  bucket?: string;
  onInsert: (tag: string) => void;
  maxBytes?: number;
  className?: string;
};

function extFromFile(f: File) {
  const name = f.name || "";
  const idx = name.lastIndexOf(".");
  const ext = idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
  return ext || (f.type.split("/")[1] || "bin");
}

export function ImageInsertButton({
  bucket = "media",
  onInsert,
  maxBytes = 3 * 1024 * 1024,
  className
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const label = busy ? t("common.uploading") : t("common.addImage");

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0] ?? null;
          // reset input so the same file can be reselected
          e.currentTarget.value = "";
          if (!f) return;

          setErr(null);

          if (f.size > maxBytes) {
            setErr(t("common.imageTooLarge", { mb: String(Math.round(maxBytes / 1024 / 1024)) }));
            return;
          }
          if (!f.type.startsWith("image/")) {
            setErr(t("common.error"));
            return;
          }

          setBusy(true);
          try {
            const { data: authData, error: authErr } = await supabase.auth.getUser();
            if (authErr || !authData.user) throw new Error(authErr?.message || "Not authenticated");

            const userId = authData.user.id;
            const ext = extFromFile(f);
            const path = `${userId}/${crypto.randomUUID()}.${ext}`;

            const up = await supabase.storage.from(bucket).upload(path, f, {
              cacheControl: "3600",
              upsert: false
            });
            if (up.error) throw up.error;

            const pub = supabase.storage.from(bucket).getPublicUrl(path);
            const url = pub.data.publicUrl;
            if (!url) throw new Error("No public URL");

            onInsert(`[[img:${url}]]`);
          } catch (e: any) {
            setErr(e?.message ?? t("common.error"));
          } finally {
            setBusy(false);
          }
        }}
      />

      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={[
            "rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-2 text-sm",
            "hover:bg-white/5 transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
            busy ? "opacity-60" : ""
          ].join(" ")}
        >
          {label}
        </button>

        {err ? <div className="text-xs text-red-300 break-words [overflow-wrap:anywhere]">{err}</div> : null}
      </div>
    </div>
  );
}
