"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  return pathname.startsWith(href + "/");
}

export function HeaderNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname() || "/";

  return (
    <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
      {items.map((it) => {
        const active = isActivePath(pathname, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={
              "rounded-full border px-3 py-1.5 text-sm transition " +
              (active
                ? "border-white/15 bg-white/[0.10] text-white"
                : "border-transparent text-white/80 hover:border-white/10 hover:bg-white/[0.06]")
            }
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
