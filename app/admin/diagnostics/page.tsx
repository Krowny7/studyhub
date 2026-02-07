import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getSupabaseEnv, maskKey, maskUrl } from "@/lib/env";
import { SUPABASE_CONTRACT } from "@/lib/supabase/contract";
import { DiagnosticsExportPanel, type DiagnosticsCheck, type DiagnosticsReport } from "@/components/DiagnosticsExportPanel";

// App version shown in diagnostics exports.
// Prefer an explicit value, fall back to Vercel commit, otherwise "dev".
const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION ??
  (process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : undefined) ??
  "dev";

function errorToText(err: any): string {
  if (!err) return "";
  const msg = err?.message ?? err?.error_description ?? err?.details ?? err?.hint;
  if (typeof msg === "string" && msg.trim()) return msg;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function classifyError(err: any): DiagnosticsCheck["code"] {
  const message = errorToText(err);
  if (!message) return "ERROR";
  const m = message.toLowerCase();

  if (m.includes("does not exist") || m.includes("schema cache") || m.includes("could not find the table")) return "NOT_FOUND";
  if (m.includes("permission denied") || m.includes("rls") || m.includes("not allowed") || m.includes("not authorized")) return "RLS_DENIED";
  return "ERROR";
}

function errDetail(err: any): string | null {
  const t = errorToText(err);
  return t ? t : null;
}

async function timed<T>(fn: () => PromiseLike<T>): Promise<[T, number]> {
  const start = performance.now();
  const res = await fn();
  const ms = Math.round(performance.now() - start);
  return [res, ms];
}

function CheckRow({ c }: { c: DiagnosticsCheck }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 p-3">
      <div className="font-mono text-sm">{c.name}</div>
      <div className="flex items-center gap-3">
        <div className="text-xs text-white/60">{typeof c.ms === "number" ? `${c.ms}ms` : ""}</div>
        <div className={c.ok ? "text-green-300 text-sm" : "text-red-300 text-sm"}>{c.ok ? "OK" : "FAIL"}</div>
      </div>
    </div>
  );
}

export default async function AdminDiagnosticsPage() {
  const env = getSupabaseEnv();

  if (!env) {
    const report: DiagnosticsReport = {
      generatedAt: new Date().toISOString(),
      app: { name: "cfa-hub" },
      env: { supabaseUrl: "(missing)", anonKey: "(missing)", serviceRoleConfigured: false },
      auth: { hasUser: false, note: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY" },
      checks: [
        { name: "env: NEXT_PUBLIC_SUPABASE_*", ok: false, kind: "meta", code: "MISSING_ENV", detail: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY" }
      ]
    };

    return (
      <div className="grid gap-4">
        <div className="card p-6">
          <div className="text-sm font-semibold opacity-80">Diagnostics</div>
          <div className="mt-2 text-white/80">Supabase env vars are missing. Add them to <span className="font-mono">.env.local</span> or your Vercel project.</div>
        </div>
        <DiagnosticsExportPanel report={report} />
      </div>
    );
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) redirect("/login");

  const checks: DiagnosticsCheck[] = [];

  // Auth context check (very common pitfall: server sees anon even if user is logged in in browser)
  checks.push({
    name: "auth: getUser() (server)",
    ok: !!user && !authErr,
    kind: "meta",
    code: !!user ? "OK" : "ERROR",
    detail: authErr?.message ?? (user ? `user_id=${user.id}` : "no user (anon)")
  });

  const { data: isAdminData, error: isAdminErr } = await supabase.rpc("is_app_admin");
  const isAdmin = !!isAdminData && !isAdminErr;

  checks.push({
    name: "rpc: is_app_admin() (access)",
    ok: !isAdminErr,
    kind: "access",
    code: !isAdminErr ? "OK" : classifyError(isAdminErr),
    detail: errDetail(isAdminErr),
    ms: undefined
  });

  // Schema checks (bypass RLS if service role is configured)
  const schemaClient = admin ?? supabase;
  const schemaLabel = admin ? "schema (service role)" : "schema (RLS-aware)";

  for (const t of SUPABASE_CONTRACT.tables) {
    // Don't assume a specific primary key column name (some tables use composite keys).
    // `head: true` keeps responses light while still validating existence and access.
    const [res, ms] = await timed(() => schemaClient.from(t).select("*", { count: "exact", head: true }));
    checks.push({
      name: `table: ${t}`,
      ok: !(res as any).error,
      kind: "schema",
      code: !(res as any).error ? "OK" : classifyError((res as any).error),
      detail: errDetail((res as any).error),
      ms
    });
  }

  for (const cc of SUPABASE_CONTRACT.columnChecks) {
    const [res, ms] = await timed(() =>
      schemaClient.from(cc.table).select(cc.columns.join(", "), { head: true, count: "exact" })
    );
    checks.push({
      name: `columns: ${cc.table} (${cc.columns.join(", ")})`,
      ok: !(res as any).error,
      kind: "schema",
      code: !(res as any).error ? "OK" : classifyError((res as any).error),
      detail: errDetail((res as any).error),
      ms
    });
  }

  for (const rpc of SUPABASE_CONTRACT.rpcs) {
    const [res, ms] = await timed(() => schemaClient.rpc(rpc as any));
    checks.push({
      name: `rpc: ${rpc}()`,
      ok: !(res as any).error,
      kind: "schema",
      code: !(res as any).error ? "OK" : classifyError((res as any).error),
      detail: errDetail((res as any).error),
      ms
    });
  }

  // Storage checks
  // - With SERVICE_ROLE we can list buckets (best signal for configuration)
  // - Without it, we fallback to user-level listing in specific buckets.
  const bucketsToCheck = ["avatars", "media"] as const;
  const canListBuckets = !!env.serviceRoleKey;

  if (canListBuckets) {
    try {
      const start = performance.now();
      const s = await (schemaClient as any).storage.listBuckets();
      const ms = Math.round(performance.now() - start);
      for (const b of bucketsToCheck) {
        const has = Array.isArray(s.data) && s.data.some((x: any) => x.name === b);
        checks.push({
          name: `storage: bucket '${b}'`,
          ok: !!s.data && !s.error && has,
          kind: "schema",
          code: !!s.data && !s.error && has ? "OK" : s.error ? classifyError(s.error) : "ERROR",
          detail: errDetail(s.error) ?? (has ? null : "Bucket not found"),
          ms
        });
      }
    } catch (e: any) {
      for (const b of bucketsToCheck) {
        checks.push({
          name: `storage: bucket '${b}'`,
          ok: false,
          kind: "schema",
          code: "ERROR",
          detail: e?.message ? String(e.message) : String(e)
        });
      }
    }
  } else {
    for (const b of bucketsToCheck) {
      const [res, ms] = await timed(() => supabase.storage.from(b).list("", { limit: 1 }));
      checks.push({
        name: `storage: bucket '${b}' (user access)`,
        ok: !(res as any).error,
        kind: "schema",
        code: !(res as any).error ? "OK" : classifyError((res as any).error),
        detail: errDetail((res as any).error) ?? "Set SERVICE_ROLE_KEY to validate bucket existence",
        ms
      });
    }
  }

  // Access checks (these MUST use the user client to verify policies)
  const accessTables = [
    "document_shares",
    "flashcard_set_shares",
    "quiz_set_shares",
    "exercise_sets",
    "exercise_set_shares",
    "group_memberships"
  ];

  for (const t of accessTables) {
    const [res, ms] = await timed(() => supabase.from(t).select("*", { count: "exact", head: true }));
    checks.push({
      name: `access: select on ${t} (authenticated)`,
      ok: !(res as any).error,
      kind: "access",
      code: !(res as any).error ? "OK" : classifyError((res as any).error),
      detail: errDetail((res as any).error),
      ms
    });
  }

  const report: DiagnosticsReport = {
    generatedAt: new Date().toISOString(),
    app: { name: "cfa-hub", version: APP_VERSION },
    env: {
      supabaseUrl: maskUrl(env.url),
      anonKey: maskKey(env.anonKey),
      serviceRoleConfigured: !!env.serviceRoleKey
    },
    auth: {
      hasUser: true,
      userId: user.id,
      isAdmin,
      note: !isAdmin ? "User is not app admin (some admin pages may be blocked)" : undefined
    },
    checks
  };

  const failed = checks.filter((c) => !c.ok).length;

  return (
    <div className="grid gap-4">
      <div className="card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold opacity-80">Schema & services checks (best-effort)</div>
            <div className="mt-1 text-sm text-white/70">
              These checks help spot missing tables/columns/RPCs or a wrong Supabase project. Some checks can be affected by RLS.
            </div>
            <div className="mt-2 text-xs text-white/60 font-mono">
              User: {user.id} — URL: {maskUrl(env.url)} — Mode: {schemaLabel}
            </div>
          </div>
          <div className="text-sm text-white/80">
            Failed: <span className={failed ? "text-red-300" : "text-green-300"}>{failed}</span> / {checks.length}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="font-semibold">Checks</div>
        <div className="mt-4 grid gap-2">
          {checks.map((c, idx) => (
            <CheckRow key={idx} c={c} />
          ))}
        </div>
      </div>

      <DiagnosticsExportPanel report={report} />
    </div>
  );
}
