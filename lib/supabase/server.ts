import { cookies } from "next/headers";
import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { assertSupabaseEnv } from "@/lib/env";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

/**
 * Server Supabase client using the ANON key + Next cookies.
 * This respects RLS and represents the current logged-in user (if any).
 */
export async function createClient() {
  const env = assertSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Next.js restricts setting cookies in some server contexts (e.g. Server Components).
        }
      }
    }
  });
}

/**
 * Server-only admin client (bypasses RLS) if SUPABASE_SERVICE_ROLE_KEY is configured.
 * NEVER import or use this in client components.
 */
export function createAdminClient() {
  const env = assertSupabaseEnv();
  if (!env.serviceRoleKey) return null;

  return createSupabaseJsClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
