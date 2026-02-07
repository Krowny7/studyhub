"use client";

import { useMemo, useState } from "react";
import { AdminNetLogPanel } from "@/components/AdminNetLogPanel";
import type { SupabaseNetLogEntry } from "@/lib/supabase/browser";

export type DiagnosticsCheck = {
  name: string;
  ok: boolean;
  ms?: number;
  kind: "schema" | "access" | "meta";
  code?: "OK" | "NOT_FOUND" | "RLS_DENIED" | "ERROR" | "MISSING_ENV";
  detail?: string | null;
};

export type DiagnosticsReport = {
  generatedAt: string;
  app: { name: string; version?: string };
  env: {
    supabaseUrl: string;
    anonKey: string;
    serviceRoleConfigured: boolean;
  };
  auth: {
    hasUser: boolean;
    userId?: string;
    isAdmin?: boolean;
    note?: string;
  };
  checks: DiagnosticsCheck[];
};

function downloadJson(filename: string, jsonText: string) {
  const blob = new Blob([jsonText], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DiagnosticsExportPanel(props: { report: DiagnosticsReport }) {
  const [netlog, setNetlog] = useState<SupabaseNetLogEntry[]>([]);

  const merged = useMemo(() => {
    return {
      ...props.report,
      netlog
    };
  }, [props.report, netlog]);

  const jsonText = useMemo(() => JSON.stringify(merged, null, 2), [merged]);

  return (
    <div className="grid gap-4">
      <div className="card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Export diagnostics (copy/paste)</div>
            <div className="mt-1 text-sm text-white/70">
              Copy this JSON into ChatGPT (or a ticket) for fast troubleshooting. Includes schema/access checks and the device Supabase network log.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn"
              onClick={async () => {
                await navigator.clipboard.writeText(jsonText);
              }}
            >
              Copy JSON
            </button>
            <button
              className="btn"
              onClick={() => downloadJson(`diagnostics-${new Date().toISOString().slice(0, 10)}.json`, jsonText)}
            >
              Download JSON
            </button>
          </div>
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-white/80">Preview</summary>
          <pre className="mt-3 max-h-[360px] overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/80">
{jsonText}
          </pre>
        </details>
      </div>

      <AdminNetLogPanel onSnapshot={(e) => setNetlog(e)} />
    </div>
  );
}
