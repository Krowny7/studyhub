"use client";

import { useEffect, useMemo, useState } from "react";
import { clearNetLog, readNetLog, type SupabaseNetLogEntry } from "@/lib/supabase/browser";

function formatUrl(u: string) {
  // Keep it readable
  try {
    const url = new URL(u);
    // Strip query tokens etc.
    url.search = "";
    return url.toString();
  } catch {
    return u.length > 120 ? u.slice(0, 117) + "..." : u;
  }
}

export function AdminNetLogPanel(props: { onSnapshot?: (entries: SupabaseNetLogEntry[]) => void }) {
  const [entries, setEntries] = useState<SupabaseNetLogEntry[]>([]);
  const [expanded, setExpanded] = useState(false);

  const refresh = () => {
    const e = readNetLog();
    setEntries(e);
    props.onSnapshot?.(e);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    if (!entries.length) return "No entries yet.";
    const last = entries[entries.length - 1];
    return `Last: ${last.method} ${last.status ?? ""} (${last.ms ?? ""}ms)`;
  }, [entries]);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">Device network log (Supabase)</div>
          <div className="mt-1 text-sm text-white/70">
            Stores the last 40 Supabase requests on this device (localStorage). Useful for intermittent outages/timeouts.
          </div>
          <div className="mt-1 text-xs text-white/60 font-mono">{summary}</div>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn" onClick={refresh}>Refresh</button>
          <button
            className="btn btn-danger"
            onClick={() => {
              clearNetLog();
              refresh();
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="mt-4">
        <button className="text-sm underline text-white/80" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Hide entries" : "Show entries"}
        </button>

        {expanded ? (
          <div className="mt-3 grid gap-2">
            {entries.length ? (
              entries
                .slice()
                .reverse()
                .map((e, idx) => (
                  <div key={idx} className="rounded-xl border border-white/10 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-mono text-xs">
                        {e.ts} — {e.method} — {e.status ?? ""} — {e.ms ?? ""}ms
                      </div>
                      <div className={e.ok ? "text-green-300 text-xs" : "text-red-300 text-xs"}>
                        {e.ok ? "OK" : "FAIL"}
                      </div>
                    </div>
                    <div className="mt-1 font-mono text-xs text-white/70 break-all">{formatUrl(e.url)}</div>
                    {e.error ? <div className="mt-1 text-xs text-red-300">{e.error}</div> : null}
                  </div>
                ))
            ) : (
              <div className="text-sm text-white/60">No Supabase requests recorded on this device yet.</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
