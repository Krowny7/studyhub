import { createBrowserClient } from "@supabase/ssr";
import { assertSupabaseEnv } from "@/lib/env";

export type SupabaseNetLogEntry = {
  ts: string;
  method: string;
  url: string;
  status?: number;
  ms?: number;
  ok?: boolean;
  error?: string;
};

const NETLOG_KEY = "cfaHub:supabaseNetLog:v1";
const NETLOG_MAX = 40;

function safeRead(): SupabaseNetLogEntry[] {
  try {
    const raw = localStorage.getItem(NETLOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SupabaseNetLogEntry[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(entries: SupabaseNetLogEntry[]) {
  try {
    localStorage.setItem(NETLOG_KEY, JSON.stringify(entries.slice(-NETLOG_MAX)));
  } catch {
    // ignore
  }
}

export function readNetLog(): SupabaseNetLogEntry[] {
  if (typeof window === "undefined") return [];
  return safeRead();
}

export function clearNetLog() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(NETLOG_KEY);
  } catch {
    // ignore
  }
}

function logAppend(entry: SupabaseNetLogEntry) {
  if (typeof window === "undefined") return;
  const entries = safeRead();
  entries.push(entry);
  safeWrite(entries);
}

export function createClient() {
  const env = assertSupabaseEnv();

  // Wrap fetch to keep a small rolling log in localStorage.
  const fetchWithLog: typeof fetch = async (input, init) => {
    const method = (init?.method || "GET").toUpperCase();
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const started = performance.now();

    try {
      const res = await fetch(input as any, init as any);
      const ms = Math.round(performance.now() - started);
      logAppend({
        ts: new Date().toISOString(),
        method,
        url,
        status: res.status,
        ms,
        ok: res.ok
      });
      return res;
    } catch (e: any) {
      const ms = Math.round(performance.now() - started);
      logAppend({
        ts: new Date().toISOString(),
        method,
        url,
        ms,
        ok: false,
        error: e?.message ? String(e.message) : String(e)
      });
      throw e;
    }
  };

  return createBrowserClient(env.url, env.anonKey, {
    global: { fetch: fetchWithLog }
  });
}
