import { MESSAGES } from "./messages";

export type Locale = keyof typeof MESSAGES;

export const DEFAULT_LOCALE: Locale = "fr";

export function isLocale(value: unknown): value is Locale {
  return value === "fr" || value === "en";
}

function humanizeKey(key: string): string {
  const last = key.split(".").pop() || key;
  const spaced = last
    .replaceAll("_", " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function getByPath(obj: any, path: string): string | undefined {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const dict = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
  const fallback = MESSAGES[DEFAULT_LOCALE];
  let template = getByPath(dict, key) ?? getByPath(fallback, key);
  if (!template) {
    // UX fallback: never show raw i18n keys to end users
    template = humanizeKey(key);
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[i18n] missing key: ${key} (locale=${locale})`);
    }
  }


  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      template = template.replaceAll(`{${k}}`, String(v));
    }
  }
  return template;
}
