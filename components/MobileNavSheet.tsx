"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

function initialsFromText(text: string) {
  const base = (text || "U")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();
  const parts = base.split(" ").filter(Boolean);
  const a = parts[0]?.[0] ?? "U";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

export function MobileNavSheet({
  isAuthed,
  nav,
  menuLabel,
  settingsLabel,
  localeLabel,
  loginLabel,
  signOutSlot,
  languageSwitcherSlot,
  userLabel,
  avatarUrl
}: {
  isAuthed: boolean;
  nav: NavItem[];
  menuLabel: string;
  settingsLabel: string;
  localeLabel: string;
  loginLabel: string;
  signOutSlot: React.ReactNode;
  languageSwitcherSlot: React.ReactNode;
  userLabel: string | null;
  avatarUrl: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent background scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Focus management (mobile Safari benefits from explicit focus for dialogs)
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  function onDialogKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }

    if (e.key !== "Tab") return;

    const root = panelRef.current;
    if (!root) return;

    const focusable = Array.from(
      root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true");

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const active = document.activeElement as HTMLElement | null;
    const isShift = e.shiftKey;

    if (!isShift && active === last) {
      e.preventDefault();
      first.focus();
    } else if (isShift && (active === first || !root.contains(active))) {
      e.preventDefault();
      last.focus();
    }
  }

  const initials = useMemo(() => initialsFromText(userLabel ?? "U"), [userLabel]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-secondary"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {menuLabel}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60]"
          onKeyDown={onDialogKeyDown}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Close"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />

          <div
            ref={panelRef}
            className="absolute right-0 top-0 h-full w-[min(88vw,22rem)] border-l border-white/10 bg-neutral-950/95 p-4 shadow-2xl backdrop-blur"
            aria-label={menuLabel}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold opacity-80">{menuLabel}</div>
              <button
                type="button"
                className="btn btn-ghost px-3"
                onClick={() => setOpen(false)}
                ref={closeButtonRef}
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              {isAuthed ? (
                <>
                  <div className="grid gap-1">
                    {nav.map((it) => (
                      <Link key={it.href} href={it.href} className="btn btn-secondary justify-start">
                        {it.label}
                      </Link>
                    ))}
                  </div>

                  <div className="my-2 h-px bg-white/10" />

                  <Link href="/profile" className="btn btn-secondary justify-start" title={userLabel ?? "Profile"}>
                    <div className="flex w-full items-center gap-3">
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarUrl} alt="avatar" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs">
                          {initials}
                        </div>
                      )}
                      <span className="min-w-0 flex-1 truncate opacity-90">{userLabel ?? "Profile"}</span>
                    </div>
                  </Link>

                  <Link href="/settings" className="btn btn-ghost justify-start" title={settingsLabel}>
                    {settingsLabel}
                  </Link>

                  <div className="my-2 h-px bg-white/10" />

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-xs font-semibold opacity-70">{localeLabel}</div>
                    <div className="mt-2">{languageSwitcherSlot}</div>
                  </div>

                  <div className="mt-2">{signOutSlot}</div>
                </>
              ) : (
                <>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-xs font-semibold opacity-70">{localeLabel}</div>
                    <div className="mt-2">{languageSwitcherSlot}</div>
                  </div>

                  <div className="my-2 h-px bg-white/10" />

                  <Link href="/login" className="btn btn-secondary justify-start">
                    {loginLabel}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
