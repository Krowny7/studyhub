"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, t as tCore, type Locale } from "@/lib/i18n/core";

type I18nContextValue = {
  locale: Locale;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => Promise<void>;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  initialLocale,
  children
}: {
  initialLocale?: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale && isLocale(initialLocale) ? initialLocale : DEFAULT_LOCALE);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => tCore(locale, key, vars),
    [locale]
  );

  const setLocale = useCallback(
    async (nextLocale: Locale) => {
      if (!isLocale(nextLocale) || nextLocale === locale) return;

      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale })
      });

      setLocaleState(nextLocale);
      router.refresh();
    },
    [locale, router]
  );

  const value = useMemo<I18nContextValue>(() => ({ locale, t, setLocale }), [locale, t, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
