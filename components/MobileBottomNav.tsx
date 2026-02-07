"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: React.ReactNode };

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  return pathname.startsWith(href + "/");
}

export function MobileBottomNav({ enabled, items }: { enabled: boolean; items: NavItem[] }) {
  const pathname = usePathname() || "/";

  if (!enabled) return null;

  return (
    <nav
      aria-label="Primary"
      className="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-neutral-950/90 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-6xl items-stretch justify-around px-2">
        {items.map((it) => {
          const active = isActivePath(pathname, it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={
                // Keep a comfortable touch target (>=48dp) even when labels wrap.
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 min-h-[56px] text-xs transition " +
                (active ? "text-white" : "text-white/65 hover:text-white")
              }
            >
              <span className={"inline-flex h-6 w-6 items-center justify-center " + (active ? "opacity-100" : "opacity-80")}>{it.icon}</span>
              <span className="truncate">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
