import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/core";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
import { HeaderNav } from "@/components/HeaderNav";
import { MobileNavSheet } from "@/components/MobileNavSheet";
import { MobileBottomNav } from "@/components/MobileBottomNav";

function initialsFromEmail(email: string | null | undefined) {
  if (!email) return "U";
  const base = email.split("@")[0] || "U";
  const parts = base
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const a = parts[0]?.[0] ?? "U";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

export async function Header() {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  let username: string | null = null;
  let avatarUrl: string | null = null;
  let elo: number | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username,avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    username = (profile as any)?.username ?? null;
    avatarUrl = (profile as any)?.avatar_url ?? null;

    // Elo (PvP). Best-effort: if SQL isn't applied yet, we just hide it.
    const { data: rating } = await supabase
      .from("ratings")
      .select("elo")
      .eq("user_id", user.id)
      .maybeSingle();
    elo = (rating as any)?.elo ?? null;
  }

  const nav = [
    { href: "/library", label: t(locale, "nav.library") },
    { href: "/flashcards", label: t(locale, "nav.flashcards") },
    { href: "/qcm", label: t(locale, "nav.qcm") },
    { href: "/exercises", label: t(locale, "nav.exercises") },
    { href: "/challenges", label: t(locale, "nav.challenges") },
    { href: "/people", label: t(locale, "nav.people") }
  ];

  const icon = {
    book: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
        <path
          d="M4.5 5.5c0-1.1.9-2 2-2H19v16.5H6.5c-1.1 0-2 .9-2 2V5.5Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M19 3.5v17" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
    cards: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
        <path
          d="M6.5 7.5h11c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2h-11c-1.1 0-2-.9-2-2v-8c0-1.1.9-2 2-2Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M7.5 4.5h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M7.5 7.5v-1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
    quiz: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
        <path
          d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M8.5 8.5h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M8.5 12h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M8.5 15.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
    people: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
        <path
          d="M16 20c0-2.2-1.8-4-4-4s-4 1.8-4 4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M12 13.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
      </svg>
    )
    ,
    exercises: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
        <path
          d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M8.5 8.5h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M8.5 12h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M8.5 15.5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
    ,
    duel: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
        <path
          d="M7 7 3 3m4 4 3-3M6 6l4 4M17 7l4-4m-4 4-3-3m1 1-4 4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8 16l-5 5m5-5 2 2m-2-2 2-2m8 2 5 5m-5-5-2 2m2-2-2-2"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  };

  const bottomNav = [
    { href: "/library", label: t(locale, "nav.library"), icon: icon.book },
    { href: "/flashcards", label: t(locale, "nav.flashcards"), icon: icon.cards },
    { href: "/qcm", label: t(locale, "nav.qcm"), icon: icon.quiz },
    { href: "/exercises", label: t(locale, "nav.exercises"), icon: icon.exercises }
  ];

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-neutral-950/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
          {/* Brand + desktop nav */}
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex items-center gap-2 whitespace-nowrap font-semibold tracking-tight">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-blue-400/90 shadow-[0_0_0_3px_rgba(59,130,246,0.18)]" />
              {t(locale, "appName")}
            </Link>

            {user ? <HeaderNav items={nav} /> : null}
          </div>

          {/* Desktop actions */}
          <div className="hidden items-center gap-2 sm:flex">
            <LanguageSwitcher />

            {user ? (
              <>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs hover:bg-white/[0.06]"
                  title={t(locale, "profile.title")}
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="avatar" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[10px]">
                      {initialsFromEmail(user.email)}
                    </div>
                  )}

                  <span className="hidden max-w-[160px] truncate opacity-80 md:inline">
                    {username || user.email}
                  </span>

                  {typeof elo === "number" ? (
                    <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/80 md:inline">
                      Elo {elo}
                    </span>
                  ) : null}
                </Link>

                <SignOutButton />
              </>
            ) : (
              <Link
                className="btn btn-secondary whitespace-nowrap"
                href="/login"
              >
                {t(locale, "auth.login")}
              </Link>
            )}
          </div>

          {/* Mobile menu (drawer) */}
          <MobileNavSheet
            isAuthed={!!user}
            nav={nav}
            menuLabel={t(locale, "common.menu")}
            settingsLabel={t(locale, "nav.settings")}
            localeLabel={t(locale, "locale.label")}
            loginLabel={t(locale, "auth.login")}
            signOutSlot={user ? <SignOutButton /> : null}
            languageSwitcherSlot={<LanguageSwitcher />}
            userLabel={
              user
                ? `${username || user.email}${typeof elo === "number" ? ` · Elo ${elo}` : ""}`
                : null
            }
            avatarUrl={user ? avatarUrl : null}
          />
        </div>
      </div>
    </header>

    {/* Mobile: bottom navigation for thumb-reach primary destinations */}
    <MobileBottomNav enabled={!!user} items={bottomNav} />
    </>
  );
}
