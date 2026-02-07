import Link from "next/link";

type Scope = "all" | "private" | "shared" | "public";

function buildHref(basePath: string, current: Record<string, any>, scope: Scope) {
  const sp = new URLSearchParams();
  const next = { ...current };
  if (scope === "all") delete next.scope;
  else next.scope = scope;
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

export function ScopeTabs({
  basePath,
  currentQuery,
  active,
  labels
}: {
  basePath: string;
  currentQuery: Record<string, any>;
  active: Scope;
  labels: { all: string; private: string; shared: string; public: string };
}) {
  const tabs: { key: Scope; label: string }[] = [
    { key: "all", label: labels.all },
    { key: "private", label: labels.private },
    { key: "shared", label: labels.shared },
    { key: "public", label: labels.public }
  ];

  return (
    <div className="sm:hidden">
      <div className="grid grid-cols-4 gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-2">
        {tabs.map((t) => {
          const isActive = active === t.key;
          return (
            <Link
              key={t.key}
              href={buildHref(basePath, currentQuery, t.key)}
              className={
                "rounded-xl px-2 py-2 text-center text-xs font-semibold transition " +
                (isActive ? "bg-white/[0.10]" : "hover:bg-white/[0.06] opacity-80")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
