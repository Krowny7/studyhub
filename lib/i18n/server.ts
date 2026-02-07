import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./core";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("cfa_locale")?.value;
  if (raw && isLocale(raw)) return raw;
  return DEFAULT_LOCALE;
}
