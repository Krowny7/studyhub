"use client";

import { createClient } from "@/lib/supabase/browser";
import { useI18n } from "@/components/I18nProvider";

export function SignOutButton() {
  const supabase = createClient();
  const { t } = useI18n();

  return (
    <button
      className="btn btn-secondary whitespace-nowrap"
      type="button"
      onClick={async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
      }}
    >
      {t("auth.logout")}
    </button>
  );
}
