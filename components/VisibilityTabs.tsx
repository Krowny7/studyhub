import Link from "next/link";

type Scope = "private" | "shared" | "public";

function buildHref(basePath: string, current: Record<string, any>, scope: Scope) {
  const sp = new URLSearchParams();
  const next = { ...current, scope };
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.join(","));
    } else {
      const s = String(v);
      if (s.trim().length) sp.set(k, s);
    }
  }
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function toneClasses(scope: Scope, active: boolean) {
  // Keep Private / Groups / Public visually distinct.
  // Private: neutral; Groups: blue; Public: emerald.
  const base = "flex-1 rounded-xl px-3 py-2 text-center text-sm font-semibold transition sm:flex-none sm:min-w-[140px]";
  const inactive = "opacity-80 hover:bg-white/[0.06]";
  if (scope === "private") {
    return base + " " + (active ? "bg-white/[0.10]" : inactive);
  }
  if (scope === "shared") {
    return (
      base +
      " " +
      (active ? "bg-blue-500/15 ring-1 ring-blue-400/25" : "hover:bg-blue-500/10 opacity-85")
    );
  }
  return (
    base +
    " " +
    (active ? "bg-emerald-500/15 ring-1 ring-emerald-400/25" : "hover:bg-emerald-500/10 opacity-85")
  );
}

function badgeClasses(scope: Scope, active: boolean) {
  const base = "rounded-full border px-2 py-0.5 text-xs font-semibold";
  if (scope === "private") {
    return base + " border-white/10 bg-white/[0.04] text-white/80";
  }
  if (scope === "shared") {
    return base + " border-blue-400/25 bg-blue-400/10 text-blue-100";
  }
  return base + " border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
}

export function VisibilityTabs({
  basePath,
  currentQuery,
  active,
  labels,
  counts
}: {
  basePath: string;
  currentQuery: Record<string, any>;
  active: Scope;
  labels: { private: string; shared: string; public: string };
  counts: { private: number; shared: number; public: number };
}) {
  const tabs: { key: Scope; label: string; count: number }[] = [
    { key: "private", label: labels.private, count: counts.private },
    { key: "shared", label: labels.shared, count: counts.shared },
    { key: "public", label: labels.public, count: counts.public }
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-2">
      <div className="flex gap-2">
        {tabs.map((t) => {
          const isActive = active === t.key;
          return (
            <Link
              key={t.key}
              href={buildHref(basePath, currentQuery, t.key)}
              aria-current={isActive ? "page" : undefined}
              className={toneClasses(t.key, isActive)}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <span>{t.label}</span>
                <span className={badgeClasses(t.key, isActive)}>{t.count}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
