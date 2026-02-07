import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/core";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const nextLocale = isLocale(body?.locale) ? body.locale : DEFAULT_LOCALE;

  const cookieStore = await cookies();
  cookieStore.set("cfa_locale", nextLocale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365
  });

  return NextResponse.json({ ok: true, locale: nextLocale });
}
