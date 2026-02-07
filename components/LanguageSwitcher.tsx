"use client";

import { useI18n } from "@/components/I18nProvider";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 text-xs">
      <span className="sr-only">{t("locale.label")}</span>
      <button
        type="button"
        onClick={() => setLocale("fr")}
        className={`rounded-full px-2 py-1 transition ${
          locale === "fr" ? "bg-white/[0.10] text-white" : "text-white/70 hover:bg-white/[0.06] hover:text-white"
        }`}
        aria-label="FR"
      >
        {t("locale.fr")}
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`rounded-full px-2 py-1 transition ${
          locale === "en" ? "bg-white/[0.10] text-white" : "text-white/70 hover:bg-white/[0.06] hover:text-white"
        }`}
        aria-label="EN"
      >
        {t("locale.en")}
      </button>
    </div>
  );
}
