"use client";

import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";

export function LoginButton() {
  const supabase = createClient();
  const { t } = useI18n();

  return (
    <button
      className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
      type="button"
      onClick={async () => {
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth/callback` }
        });
      }}
    >
      {t("auth.signInWithGoogle")}
    </button>
  );
}
