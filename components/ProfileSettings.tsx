"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

export function ProfileSettings() {
  const supabase = useMemo(() => createClient(), []);
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg(null);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth.user;
        if (!user) return;

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("username,avatar_url")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;

        setUsername((profile as any)?.username ?? "");
        setAvatarUrl((profile as any)?.avatar_url ?? null);
      } catch (e: any) {
        setMsg(`❌ ${e?.message ?? t("common.error")}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase, t]);

  async function saveUsername() {
    setMsg(null);
    setBusy(true);
    try {
      const next = username.trim();
      if (!USERNAME_RE.test(next)) {
        throw new Error(t("settings.usernameHint"));
      }

      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) throw new Error("Not logged in");

      const { error } = await supabase.from("profiles").update({ username: next }).eq("id", user.id);
      if (error) throw error;

      setMsg(t("settings.updated"));
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(file: File) {
    setMsg(null);
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) throw new Error("Not logged in");

      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.id}/${Date.now()}.${ext}`;

      const up = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        contentType: file.type
      });
      if (up.error) throw up.error;

      const pub = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = pub.data.publicUrl;

      const { error } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
      if (error) throw error;

      setAvatarUrl(publicUrl);
      setMsg(t("settings.updated"));
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? t("common.error")}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <h2 className="text-base font-semibold">{t("settings.profileTitle")}</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="card-soft p-4">
          <div className="text-sm font-medium">{t("settings.usernameLabel")}</div>
          <div className="mt-1 text-xs opacity-70">{t("settings.usernameHint")}</div>

          <input
            className="input mt-3"
            placeholder={t("settings.usernamePlaceholder")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading || busy}
          />

          <button
            className="btn btn-primary mt-3"
            onClick={saveUsername}
            disabled={loading || busy}
            type="button"
          >
            {busy ? t("common.saving") : t("settings.update")}
          </button>
        </div>

        <div className="card-soft p-4">
          <div className="text-sm font-medium">{t("settings.avatarLabel")}</div>
          <div className="mt-1 text-xs opacity-70">{t("settings.avatarHint")}</div>

          <div className="mt-3 flex items-center gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="avatar" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-xs opacity-70">
                —
              </div>
            )}

            <label className="btn btn-secondary cursor-pointer">
              {t("settings.upload")}
              <input
                className="hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={loading || busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAvatar(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {msg && <div className="mt-3 text-sm">{msg}</div>}
    </div>
  );
}
