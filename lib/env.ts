export type SupabaseEnv = {
  url: string;
  anonKey: string;
  /** Server-only. Never expose to the browser. */
  serviceRoleKey?: string;
};

/**
 * Returns validated Supabase env vars, or null if missing.
 * Useful for diagnostics pages where we want to render a helpful UI.
 */
export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) return null;
  return { url, anonKey, serviceRoleKey: serviceRoleKey || undefined };
}

export function assertSupabaseEnv(): SupabaseEnv {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return env;
}

export function maskUrl(url: string): string {
  const m = url.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  if (m) return `https://${m[1]}.supabase.co`;
  return url.slice(0, 48);
}

export function maskKey(key: string): string {
  if (!key) return "(missing)";
  if (key.length <= 10) return `${key.slice(0, 3)}…${key.slice(-3)}`;
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}
