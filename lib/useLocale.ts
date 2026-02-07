"use client";

// Convenience hook used by a few client components.
// The canonical source of truth is the I18nProvider context.

import { useI18n } from "@/components/I18nProvider";

export function useLocale() {
  return useI18n().locale;
}
