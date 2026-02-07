"use client";

import { I18nProvider } from "@/components/I18nProvider";
import type { Locale } from "@/lib/i18n/core";

export function Providers({
  children,
  initialLocale
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  return <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>;
}
